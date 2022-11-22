import { Logger } from 'winston'
import { WebSocket } from 'ws'
import { unprotectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { literal } from '@sofie-automation/shared-lib/dist/lib/lib'
import { WsTopicBase, WsTopic, CollectionObserver } from '../wsHandler'

interface PartStatus {
	id: string
	name: string
	autoNext?: boolean
}

interface ActivePlaylistStatus {
	event: string
	id: string | null
	name: string
	rundownIds: string[]
	currentPart: PartStatus | null
	nextPart: PartStatus | null
}

export class ActivePlaylistTopic
	extends WsTopicBase
	implements WsTopic, CollectionObserver<DBRundownPlaylist>, CollectionObserver<DBPartInstance[]>
{
	_observerName = 'ActivePlaylistTopic'
	_activePlaylist: DBRundownPlaylist | undefined
	_currentPartInstance: DBPartInstance | undefined
	_nextPartInstance: DBPartInstance | undefined

	constructor(logger: Logger) {
		super('ActivePlaylistTopic', logger)
	}

	addSubscriber(ws: WebSocket): void {
		super.addSubscriber(ws)
		this.sendStatus(new Set<WebSocket>().add(ws))
	}

	sendStatus(subscribers: Set<WebSocket>): void {
		const currentPart = this._currentPartInstance ? this._currentPartInstance.part : null
		const nextPart = this._nextPartInstance ? this._nextPartInstance.part : null
		subscribers.forEach((ws) => {
			this.sendMessage(
				ws,
				this._activePlaylist
					? literal<ActivePlaylistStatus>({
							event: 'activePlaylist',
							id: unprotectString(this._activePlaylist._id),
							name: this._activePlaylist.name,
							rundownIds: this._activePlaylist.rundownIdsInOrder.map((r) => unprotectString(r)),
							currentPart: currentPart
								? literal<PartStatus>({
										id: unprotectString(currentPart._id),
										name: currentPart.title,
										autoNext: currentPart.autoNext,
								  })
								: null,
							nextPart: nextPart
								? literal<PartStatus>({
										id: unprotectString(nextPart._id),
										name: nextPart.title,
										autoNext: nextPart.autoNext,
								  })
								: null,
					  })
					: literal<ActivePlaylistStatus>({
							event: 'activePlaylist',
							id: null,
							name: 'No Active Playlist',
							rundownIds: [],
							currentPart: null,
							nextPart: null,
					  })
			)
		})
	}

	update(data: DBRundownPlaylist | DBPartInstance[] | undefined): void {
		if (Array.isArray(data)) {
			this._logger.info(
				`${this._name} received partInstances update with parts [${data.map((pi) => pi.part._id)}]`
			)
			this._currentPartInstance = data?.filter((pi) => pi._id === this._activePlaylist?.currentPartInstanceId)[0]
			this._nextPartInstance = data?.filter((pi) => pi._id === this._activePlaylist?.nextPartInstanceId)[0]
		} else {
			this._logger.info(`${this._name} received playlist update ${data?._id}, activationId ${data?.activationId}`)
			const activationId = unprotectString(data?.activationId)
			this._activePlaylist = activationId ? data : undefined
		}
		process.nextTick(() => this.sendStatus(this._subscribers))
	}
}
