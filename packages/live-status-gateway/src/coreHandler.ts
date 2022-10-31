import { CoreConnection, CoreOptions, DDPConnectorOptions } from '@sofie-automation/server-core-integration'

import { DeviceConfig } from './connector'
import { Logger } from 'winston'
// eslint-disable-next-line node/no-extraneous-import
import { MemUsageReport as ThreadMemUsageReport } from 'threadedclass'
import { Process } from './process'
import { LIVE_STATUS_DEVICE_CONFIG } from './configManifest'
import {
	PeripheralDeviceCategory,
	PeripheralDeviceType,
	PERIPHERAL_SUBTYPE_PROCESS,
} from '@sofie-automation/shared-lib/dist/peripheralDevice/peripheralDeviceAPI'
import { protectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { PeripheralDeviceId } from '@sofie-automation/shared-lib/dist/core/model/Ids'
import { PeripheralDeviceAPIMethods } from '@sofie-automation/shared-lib/dist/peripheralDevice/methodsAPI'
import { StatusCode } from '@sofie-automation/shared-lib/dist/lib/status'

export interface CoreConfig {
	host: string
	port: number
	watchdog: boolean
}
export interface PeripheralDeviceCommand {
	_id: string

	deviceId: PeripheralDeviceId
	functionName: string
	args: Array<any>

	hasReply: boolean
	reply?: any
	replyError?: any

	time: number // time
}

export interface MemoryUsageReport {
	main: number
	threads: { [childId: string]: ThreadMemUsageReport }
}

/**
 * Represents a connection between the Gateway and Core
 */
export class CoreHandler {
	core!: CoreConnection
	logger: Logger
	public _observers: Array<any> = []
	public deviceSettings: { [key: string]: any } = {}

	public errorReporting = false
	public multithreading = false
	public reportAllCommands = false

	private _deviceOptions: DeviceConfig
	private _onConnected?: () => any
	private _executedFunctions: { [id: string]: boolean } = {}
	private _coreConfig?: CoreConfig
	private _process?: Process

	private _studioId: string | undefined

	private _statusInitialized = false
	private _statusDestroyed = false

	constructor(logger: Logger, deviceOptions: DeviceConfig) {
		this.logger = logger
		this._deviceOptions = deviceOptions
	}

	async init(config: CoreConfig, process: Process): Promise<void> {
		this._statusInitialized = false
		this._coreConfig = config
		this._process = process

		this.core = new CoreConnection(
			this.getCoreConnectionOptions('Live Status Gateway', 'LiveStatusGateway', PERIPHERAL_SUBTYPE_PROCESS)
		)

		this.core.onConnected(() => {
			this.logger.info('Core Connected!')
			this.setupObserversAndSubscriptions().catch((e) => {
				this.logger.error('Core Error during setupObserversAndSubscriptions:', e)
			})
			if (this._onConnected) this._onConnected()
		})
		this.core.onDisconnected(() => {
			this.logger.warn('Core Disconnected!')
		})
		this.core.onError((err) => {
			this.logger.error('Core Error: ' + (typeof err === 'string' ? err : err.message || err.toString() || err))
		})

		const ddpConfig: DDPConnectorOptions = {
			host: config.host,
			port: config.port,
		}
		if (this._process && this._process.certificates.length) {
			ddpConfig.tlsOpts = {
				ca: this._process.certificates,
			}
		}

		await this.core.init(ddpConfig)

		this.logger.info('Core id: ' + this.core.deviceId)
		await this.setupObserversAndSubscriptions()
		if (this._onConnected) this._onConnected()

		this._statusInitialized = true
		await this.updateCoreStatus()
	}
	async setupObserversAndSubscriptions(): Promise<void> {
		this.logger.info('Core: Setting up subscriptions..')
		this.logger.info('DeviceId: ' + this.core.deviceId)

		await Promise.all([
			this.core.autoSubscribe('peripheralDevices', {
				_id: this.core.deviceId,
			}),
		])
		this.logger.info('Core: Subscriptions are set up!')
		if (this._observers.length) {
			this.logger.info('CoreMos: Clearing observers..')
			this._observers.forEach((obs) => {
				obs.stop()
			})
			this._observers = []
		}
		// setup observers
		const observer = this.core.observe('peripheralDevices')
		observer.added = (id: string) => this.onDeviceChanged(protectString(id))
		observer.changed = (id: string) => this.onDeviceChanged(protectString(id))
	}
	async destroy(): Promise<void> {
		this._statusDestroyed = true
		await this.updateCoreStatus()
		await this.core.destroy()
	}
	getCoreConnectionOptions(
		name: string,
		subDeviceId: string,
		subDeviceType: PERIPHERAL_SUBTYPE_PROCESS
	): CoreOptions {
		if (!this._deviceOptions.deviceId) {
			throw new Error('DeviceId is not set!')
		}

		const options: CoreOptions = {
			deviceId: protectString(this._deviceOptions.deviceId + subDeviceId),
			deviceToken: this._deviceOptions.deviceToken,

			deviceCategory: PeripheralDeviceCategory.API,
			deviceType: PeripheralDeviceType.LIVE_STATUS,
			deviceSubType: subDeviceType,

			deviceName: name,
			watchDog: this._coreConfig ? this._coreConfig.watchdog : true,

			configManifest: LIVE_STATUS_DEVICE_CONFIG,
		}

		if (!options.deviceToken) {
			this.logger.warn('Token not set, only id! This might be unsecure!')
			options.deviceToken = 'unsecureToken'
		}

		if (subDeviceType === PERIPHERAL_SUBTYPE_PROCESS) options.versions = this._getVersions()
		return options
	}
	onConnected(fcn: () => any): void {
		this._onConnected = fcn
	}

	onDeviceChanged(id: PeripheralDeviceId): void {
		if (id !== this.core.deviceId) return
		const col = this.core.getCollection('peripheralDevices')
		if (!col) throw new Error('collection "peripheralDevices" not found!')
		const device = col.findOne(id)
		if (device) {
			this.deviceSettings = device.settings || {}
		} else {
			this.deviceSettings = {}
		}
		const logLevel = this.deviceSettings['debugLogging'] ? 'debug' : 'info'
		if (logLevel !== this.logger.level) {
			this.logger.level = logLevel

			for (const transport of this.logger.transports) {
				transport.level = logLevel
			}

			this.logger.info('Loglevel: ' + this.logger.level)
		}

		const studioId = device.studioId
		if (studioId !== this._studioId) {
			this._studioId = studioId
		}
	}

	get logDebug(): boolean {
		return !!this.deviceSettings['debugLogging']
	}

	executeFunction(cmd: PeripheralDeviceCommand, fcnObject: CoreHandler): void {
		if (cmd) {
			if (this._executedFunctions[cmd._id]) return // prevent it from running multiple times

			// Ignore specific commands, to reduce noise:
			if (cmd.functionName !== 'getDebugStates') {
				this.logger.debug(`Executing function "${cmd.functionName}", args: ${JSON.stringify(cmd.args)}`)
			}

			this._executedFunctions[cmd._id] = true
			const cb = (err: any, res?: any) => {
				if (err) {
					this.logger.error('executeFunction error', err, err.stack)
				}
				fcnObject.core.callMethod(PeripheralDeviceAPIMethods.functionReply, [cmd._id, err, res]).catch((e) => {
					this.logger.error(e)
				})
			}
			// eslint-disable-next-line @typescript-eslint/ban-types
			const fcn: Function = fcnObject[cmd.functionName as keyof CoreHandler] as Function
			try {
				if (!fcn) throw Error(`Function "${cmd.functionName}" not found on device "${cmd.deviceId}"!`)

				Promise.resolve(fcn.apply(fcnObject, cmd.args))
					.then((result) => {
						cb(null, result)
					})
					.catch((e) => {
						cb(e.toString(), null)
					})
			} catch (e: any) {
				cb(e.toString(), null)
			}
		}
	}
	retireExecuteFunction(cmdId: string): void {
		delete this._executedFunctions[cmdId]
	}
	killProcess(actually: number): boolean {
		if (actually === 1) {
			this.logger.info('KillProcess command received, shutting down in 1000ms!')
			setTimeout(() => {
				// eslint-disable-next-line no-process-exit
				process.exit(0)
			}, 1000)
			return true
		}
		return false
	}
	pingResponse(message: string): void {
		this.core.setPingResponse(message)
	}
	getSnapshot(): any {
		this.logger.info('getSnapshot')
		return {}
	}
	getDevicesInfo(): any {
		this.logger.info('getDevicesInfo')
		return []
	}
	async updateCoreStatus(): Promise<any> {
		let statusCode = StatusCode.GOOD
		const messages: Array<string> = []

		if (!this._statusInitialized) {
			statusCode = StatusCode.BAD
			messages.push('Starting up...')
		}
		if (this._statusDestroyed) {
			statusCode = StatusCode.BAD
			messages.push('Shut down')
		}

		return this.core.setStatus({
			statusCode: statusCode,
			messages: messages,
		})
	}
	private _getVersions() {
		const versions: { [packageName: string]: string } = {}

		if (process.env.npm_package_version) {
			versions['_process'] = process.env.npm_package_version
		}

		return versions
	}
}
