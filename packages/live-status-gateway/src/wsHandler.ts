import { Logger } from 'winston'
import { WebSocket } from 'ws'
import { CoreHandler } from './coreHandler'

export abstract class WsHandlerBase {
	protected _name: string
	protected _collection: string | undefined
	protected _logger: Logger
	protected _coreHandler: CoreHandler
	protected _ws: WebSocket | undefined

	constructor(name: string, collection: string | undefined, logger: Logger, coreHandler: CoreHandler) {
		this._name = name
		this._collection = collection
		this._logger = logger
		this._coreHandler = coreHandler

		this._logger.info(`Starting ${this._name} handler`)
	}

	async init(): Promise<void> {
		this._logger.info(`${this._name} handler not subscribing to any collection`)
	}

	initSocket(ws: WebSocket): void {
		this._ws = ws
		this._ws.on('message', (data) => this.processMessage(data))
		this._ws.on('close', () => this._logger.info(`Closing websocket`))
	}

	close(): void {
		this._logger.info(`Closing ${this._name} handler`)
	}

	processMessage(msg: object): void {
		this._logger.error(`Process ${this._name} message not expected '${JSON.stringify(msg)}'`)
	}

	sendMessage(msg: object): void {
		const msgStr = JSON.stringify(msg)
		this._logger.info(`Send ${this._name} message '${msgStr}'`)
		this._ws?.send(msgStr)
	}
}

export interface WsHandler {
	init(): Promise<void>
	initSocket(ws: WebSocket): void
	close(): void
	processMessage(msg: object): void
	sendMessage(msg: object): void
}

export interface CollectionData<T> {
	subscribe(observer: CollectionObserver<T>): void
	unsubscribe(observer: CollectionObserver<T>): void
	notify(data: T | undefined): void
}

export interface CollectionObserver<T> {
	_observerName: string
	update(data: T | undefined): void
}
