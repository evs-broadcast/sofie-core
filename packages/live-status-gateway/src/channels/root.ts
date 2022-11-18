import { literal } from '@sofie-automation/shared-lib/dist/lib/lib'
import { Logger } from 'winston'
import { CoreHandler } from '../coreHandler'
import { WebSocket } from 'ws'
import { WsHandlerBase, WsHandler } from '../wsHandler'

enum PublishMsg {
	ping = 'ping',
	subscribe = 'subscribe',
	unsubscribe = 'unsubscribe',
}

interface PongMsg {
	event: string
	reqid: number
}

interface SubscriptionStatus {
	event: string
	reqid: number
	errorMessage?: string
}

export enum StatusChannels {
	studio = 'studio',
	playlist = 'playlist',
	rundown = 'rundown',
	segment = 'segment',
	part = 'part',
}

interface Msg {
	event: PublishMsg
	reqid: number
	subscription: {
		name: StatusChannels
	}
}

export class RootHandler extends WsHandlerBase implements WsHandler {
	_handlers: Map<string, WsHandler> = new Map()
	_heartbeat: NodeJS.Timeout | undefined

	constructor(logger: Logger, coreHandler: CoreHandler) {
		super('root', undefined, logger, coreHandler)
	}

	async init(): Promise<void> {
		this._logger.info(`${this._name} handler initialising heatbeat`)
		this._heartbeat = setInterval(
			() => this._subscribers.forEach((ws) => this.sendMessage(ws, { event: 'heartbeat' })),
			2000
		)
	}

	close(): void {
		clearInterval(this._heartbeat)
		super.close()
		this._handlers.forEach((h) => h.close())
	}

	removeSubscriber(ws: WebSocket): void {
		super.removeSubscriber(ws)
		this._handlers.forEach((h) => h.removeSubscriber(ws))
	}

	processMessage(ws: WebSocket, msg: object): void {
		this._logger.info(`Process root message '${msg}'`)
		try {
			const msgObj = JSON.parse(msg as unknown as string) as Msg
			if (typeof msgObj.event === 'string' && typeof msgObj.reqid === 'number') {
				switch (msgObj.event) {
					case PublishMsg.ping:
						this.sendMessage(ws, literal<PongMsg>({ event: 'pong', reqid: msgObj.reqid }))
						return
					case PublishMsg.subscribe:
						this._logger.info(`Subscribe request to '${msgObj.subscription.name}' channel`)
						this.subscribe(ws, msgObj.subscription.name, msgObj.reqid)
						return
					case PublishMsg.unsubscribe:
						this._logger.info(`Unsubscribe request to '${msgObj.subscription.name}' channel`)
						this.unsubscribe(ws, msgObj.subscription.name, msgObj.reqid)
						return
				}
			} else this._logger.error(`Process root message received malformed payload`)
		} catch (e) {
			this._logger.error(`Process root message expected an object as payload`)
		}
	}

	async addHandler(channel: string, handler: WsHandler): Promise<void> {
		await handler.init()
		if (channel in StatusChannels) this._handlers.set(channel, handler)
	}

	subscribe(ws: WebSocket, name: string, reqid: number): void {
		const handler = this._handlers.get(name)
		if (handler && name in StatusChannels) {
			this.sendMessage(
				ws,
				literal<SubscriptionStatus>({
					event: 'subscriptionStatus',
					reqid: reqid,
				})
			)
			handler.addSubscriber(ws)
		} else {
			this.sendMessage(
				ws,
				literal<SubscriptionStatus>({
					errorMessage: `Subscription to channel '${name}' failed`,
					event: 'subscriptionStatus',
					reqid: reqid,
				})
			)
		}
	}

	unsubscribe(ws: WebSocket, name: string, reqid: number): void {
		const handler = this._handlers.get(name)
		if (handler && name in StatusChannels) {
			handler.removeSubscriber(ws)
			this.sendMessage(
				ws,
				literal<SubscriptionStatus>({
					event: 'subscriptionStatus',
					reqid: reqid,
				})
			)
		} else {
			this.sendMessage(
				ws,
				literal<SubscriptionStatus>({
					errorMessage: `Subscription to channel '${name}' failed`,
					event: 'subscriptionStatus',
					reqid: reqid,
				})
			)
		}
	}
}
