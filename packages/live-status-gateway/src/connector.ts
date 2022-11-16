import { CoreHandler, CoreConfig } from './coreHandler'
import { Logger } from 'winston'
import { Process } from './process'
import { PeripheralDeviceId } from '@sofie-automation/shared-lib/dist/core/model/Ids'
import { WebSocketServer } from 'ws'
import { WsHandler } from './wsHandler'
import { RootHandler } from './channels/root'
import { StudioHandler } from './channels/studio'
import { PlaylistHandler } from './channels/playlist'
import { RundownHandler } from './channels/rundown'
import { PartHandler } from './channels/part'
import { PartInstancesHandler } from './channels/partInstances'

export interface Config {
	process: ProcessConfig
	device: DeviceConfig
	core: CoreConfig
}
export interface ProcessConfig {
	/** Will cause the Node applocation to blindly accept all certificates. Not recommenced unless in local, controlled networks. */
	unsafeSSL: boolean
	/** Paths to certificates to load, for SSL-connections */
	certificates: string[]
}
export interface DeviceConfig {
	deviceId: PeripheralDeviceId
	deviceToken: string
}
export class Connector {
	private coreHandler: CoreHandler | undefined
	private _logger: Logger
	private _process: Process | undefined

	constructor(logger: Logger) {
		this._logger = logger
	}

	public async init(config: Config): Promise<void> {
		try {
			this._logger.info('Initializing Process...')
			this._process = new Process(this._logger)
			this._process.init(config.process)
			this._logger.info('Process initialized')

			this._logger.info('Initializing Core...')
			this.coreHandler = new CoreHandler(this._logger, config.device)
			await this.coreHandler.init(config.core, this._process)
			this._logger.info('Core initialized')

			this._logger.info('Initializing WebSocket server...')
			const handlers: Map<string, WsHandler> = new Map()

			const rootHandler = new RootHandler(this._logger, this.coreHandler)
			await rootHandler.init()
			handlers.set('/', rootHandler)

			const studioHandler = new StudioHandler(this._logger, this.coreHandler)
			await studioHandler.init()
			handlers.set('/studio', studioHandler)

			const playlistHandler = new PlaylistHandler(this._logger, this.coreHandler)
			await playlistHandler.init()
			handlers.set('/playlist', playlistHandler)

			const rundownHandler = new RundownHandler(this._logger, this.coreHandler)
			await rundownHandler.init()
			handlers.set('/rundown', rundownHandler)

			const partHandler = new PartHandler(this._logger, this.coreHandler)
			await partHandler.init()
			handlers.set('/part', partHandler)

			const partInstancesHandler = new PartInstancesHandler(this._logger, this.coreHandler)
			await partInstancesHandler.init()
			handlers.set('/partInstances', partInstancesHandler)

			playlistHandler.playlistsHandler.subscribe(studioHandler)
			playlistHandler.subscribe(rundownHandler)
			playlistHandler.subscribe(partHandler)
			playlistHandler.subscribe(partInstancesHandler)
			partInstancesHandler.subscribe(playlistHandler)
			partInstancesHandler.subscribe(rundownHandler)
			partInstancesHandler.subscribe(partHandler)

			const wss = new WebSocketServer({ port: 8080 })
			wss.on('connection', (ws, request) => {
				this._logger.info(`WebSocket connection requested for path '${request.url}'`)
				if (typeof request.url === 'string' && handlers.get(request.url)) {
					handlers.get(request.url)?.initSocket(ws)
				} else {
					this._logger.error(`WebSocket connection request for unsupported path '${request.url}'`)
				}
			})
			wss.on('close', () => {
				this._logger.info(`WebSocket connection closed`)
				handlers.forEach((h) => h.close())
				handlers.clear()
			})
			wss.on('error', (err) => this._logger.error(err.message))

			this._logger.info('WebSocket server initialized')

			this._logger.info('Initialization done')
			return
		} catch (e: any) {
			this._logger.error('Error during initialization:')
			this._logger.error(e)
			this._logger.error(e.stack)

			try {
				if (this.coreHandler) {
					this.coreHandler.destroy().catch(this._logger.error)
				}
			} catch (e) {
				// Handle the edge case where destroy() throws synchronously:
				this._logger.error(e)
			}

			this._logger.info('Shutting down in 10 seconds!')
			setTimeout(() => {
				// eslint-disable-next-line no-process-exit
				process.exit(0)
			}, 10 * 1000)
			return
		}
	}
}
