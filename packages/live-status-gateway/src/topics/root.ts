import { Logger } from 'winston'
import { WebSocket } from 'ws'
import { literal } from '@sofie-automation/shared-lib/dist/lib/lib'
import { WsTopicBase, WsTopic } from '../wsHandler'

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
	activePlaylist = 'activePlaylist',
}

interface Msg {
	event: PublishMsg
	reqid: number
	subscription: {
		name: StatusChannels
	}
}

export class RootChannel extends WsTopicBase implements WsTopic {
	_topics: Map<string, WsTopic> = new Map()
	_heartbeat: NodeJS.Timeout | undefined

	constructor(logger: Logger) {
		super('Root', logger)
		this._heartbeat = setInterval(
			() => this._subscribers.forEach((ws) => this.sendMessage(ws, { event: 'heartbeat' })),
			2000
		)
	}

	close(): void {
		clearInterval(this._heartbeat)
	}

	removeSubscriber(ws: WebSocket): void {
		super.removeSubscriber(ws)
		this._topics.forEach((h) => h.removeSubscriber(ws))
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
					default:
						this._logger.info(`Process root message received unexpected event`)
				}
			} else this._logger.error(`Process root message received malformed payload`)
		} catch (e) {
			this._logger.error(`Process root message expected an object as payload`)
		}
	}

	addTopic(channel: string, topic: WsTopic): void {
		if (channel in StatusChannels) this._topics.set(channel, topic)
	}

	subscribe(ws: WebSocket, name: string, reqid: number): void {
		const topic = this._topics.get(name)
		if (topic && name in StatusChannels) {
			this.sendMessage(
				ws,
				literal<SubscriptionStatus>({
					event: 'subscriptionStatus',
					reqid: reqid,
				})
			)
			topic.addSubscriber(ws)
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
		const topic = this._topics.get(name)
		if (topic && name in StatusChannels) {
			topic.removeSubscriber(ws)
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
