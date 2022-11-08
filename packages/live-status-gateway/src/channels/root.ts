import { literal } from '@sofie-automation/shared-lib/dist/lib/lib'
import { Logger } from 'winston'
import { CoreHandler } from '../coreHandler'
import { WebSocket } from 'ws'
import { WsHandlerBase, WsHandler } from '../wsHandler'

interface PingMsg {
	event: string
	reqid: number
}

interface PongMsg {
	event: string
	reqid: number
}

export class RootHandler extends WsHandlerBase implements WsHandler {
	_heartbeat: NodeJS.Timeout | undefined

	constructor(logger: Logger, coreHandler: CoreHandler) {
		super('root', undefined, logger, coreHandler)
	}

	initSocket(ws: WebSocket): void {
		super.initSocket(ws)
		this._heartbeat = setInterval(() => this.sendMessage({ event: 'heartbeat' }), 2000)
	}

	close(): void {
		clearInterval(this._heartbeat)
		super.close()
	}

	processMessage(msg: object): void {
		this._logger.info(`Process root message '${msg}'`)
		try {
			const msgObj = JSON.parse(msg as unknown as string) as PingMsg
			if (typeof msgObj.event === 'string' && msgObj.event === 'ping' && typeof msgObj.reqid === 'number') {
				this.sendMessage(literal<PongMsg>({ event: 'pong', reqid: msgObj.reqid }))
			} else this._logger.error(`Process root message received malformed payload`)
		} catch (e) {
			this._logger.error(`Process root message expected an object as payload`)
		}
	}
}
