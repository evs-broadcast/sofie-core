import { Logger } from 'winston'
import { WebSocket } from 'ws'
import { CoreHandler } from './coreHandler'

export abstract class WsHandlerBase {
	protected _name: string
	protected _collection: string | undefined
	protected _logger: Logger
	protected _coreHandler: CoreHandler
	protected _subscribers: Set<WebSocket> = new Set()

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

	close(): void {
		this._logger.info(`Closing ${this._name} handler`)
	}

	addSubscriber(ws: WebSocket): void {
		this._logger.info(`${this._name} adding a subscription`)
		ws.on('message', (data) => this.processMessage(ws, data))
		this._subscribers.add(ws)
	}

	removeSubscriber(ws: WebSocket): void {
		if (this._subscribers.delete(ws)) this._logger.info(`${this._name} removing a subscription`)
	}

	processMessage(_ws: WebSocket, msg: object): void {
		this._logger.error(`Process ${this._name} message not expected '${JSON.stringify(msg)}'`)
	}

	sendMessage(ws: WebSocket, msg: object): void {
		const msgStr = JSON.stringify(msg)
		this._logger.info(`Send ${this._name} message '${msgStr}'`)
		ws.send(msgStr)
	}
}

export interface WsHandler {
	init(): Promise<void>
	close(): void
	addSubscriber(ws: WebSocket): void
	removeSubscriber(ws: WebSocket): void
	processMessage(ws: WebSocket, msg: object): void
	sendMessage(ws: WebSocket, msg: object): void
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
