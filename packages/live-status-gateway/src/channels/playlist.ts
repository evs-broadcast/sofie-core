import { Logger } from 'winston'
import { CoreHandler } from '../coreHandler'
import { WebSocket } from 'ws'
import { WsHandlerBase, WsHandler, CollectionObserver, CollectionData } from '../wsHandler'
import { CoreConnection } from '@sofie-automation/server-core-integration'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { literal } from '@sofie-automation/shared-lib/dist/lib/lib'
import { unprotectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'

interface ActiveStatus {
	active: boolean
}

interface PlaylistStatus extends ActiveStatus {
	id: string
	name: string
	rundownIds: string[]
	currentPartId: string | null
	nextPartId: string | null
	nextSegmentId: string | undefined
}

export class PlaylistsHandler implements CollectionData<DBRundownPlaylist[]> {
	_collection: string
	_logger: Logger
	_playlists: DBRundownPlaylist[] | undefined
	_playlistsObservers: Set<CollectionObserver<DBRundownPlaylist[]>> = new Set()

	constructor(collection: string, logger: Logger) {
		this._collection = collection
		this._logger = logger
	}

	setPlaylists(playlists: DBRundownPlaylist[]): void {
		this._playlists = playlists
		this.notify(this._playlists)
	}

	subscribe(observer: CollectionObserver<DBRundownPlaylist[]>): void {
		this._logger.info(`${observer._observerName}' added observer for '${this._collection}'`)
		observer.update(this._playlists)
		this._playlistsObservers.add(observer)
	}

	unsubscribe(observer: CollectionObserver<DBRundownPlaylist[]>): void {
		this._logger.info(`${observer._observerName}' removed observer for '${this._collection}'`)
		this._playlistsObservers.delete(observer)
	}

	notify(data: DBRundownPlaylist[] | undefined): void {
		this._logger.info(`${this._collection} notifying all observers of a playlist update`)
		this._playlistsObservers.forEach((o) => o.update(data))
	}
}

export class PlaylistHandler
	extends WsHandlerBase
	implements WsHandler, CollectionData<DBRundownPlaylist>, CollectionObserver<DBPartInstance[]>
{
	_observerName = 'PlaylistHandler'
	_core: CoreConnection
	_playlistsHandler: PlaylistsHandler
	_studioId: string | undefined
	_subscriptionId: string | undefined
	_playlists: DBRundownPlaylist[] = []
	_activePlaylist: DBRundownPlaylist | undefined
	_currentPartId: string | null
	_nextPartId: string | null
	_playlistObservers: Set<CollectionObserver<DBRundownPlaylist>> = new Set()

	constructor(logger: Logger, coreHandler: CoreHandler) {
		super('playlist', 'rundownPlaylists', logger, coreHandler)
		this._core = coreHandler.coreConnection
		this._playlistsHandler = new PlaylistsHandler('Playlists', this._logger)
		this._currentPartId = null
		this._nextPartId = null
	}

	async init(): Promise<void> {
		this._studioId = this._coreHandler.studioId
		if (!(this._studioId && this._collection)) return
		this._subscriptionId = await this._coreHandler.setupSubscription(this._collection, { studioId: this._studioId })
		const observer = this._coreHandler.setupObserver(this._collection)
		if (this._collection) {
			const col = this._core.getCollection(this._collection)
			if (!col) throw new Error(`collection '${this._collection}' not found!`)
			this._playlists = col.find(undefined) as unknown as DBRundownPlaylist[]
			this._activePlaylist = this._playlists.find((p) => p.activationId)
			this._playlistsHandler.setPlaylists(this._playlists)
			observer.added = (id: string) => this.changed(id, 'added')
			observer.changed = (id: string) => this.changed(id, 'changed')
		}
	}

	initSocket(ws: WebSocket): void {
		super.initSocket(ws)
		this.sendStatus()
	}

	changed(id: string, changeType: string): void {
		this._logger.info(`${this._name} ${changeType} ${id}`)
		if (!this._collection) return
		const col = this._core.getCollection(this._collection)
		if (!col) throw new Error(`collection '${this._collection}' not found!`)
		if ('added' === changeType) {
			this._playlists = col.find(undefined) as unknown as DBRundownPlaylist[]
			this._playlistsHandler.setPlaylists(this._playlists)
		}
		const prevActivePlaylist = this._activePlaylist
		this._activePlaylist = this._playlists.find((p) => p.activationId)
		if (prevActivePlaylist !== this._activePlaylist) console.log('changed playlist')

		// notify other handlers that the playlist has changed
		this.notify(this._activePlaylist)

		// don't sendStatus if there is an active playlist and there has been a change to a different playlist
		if (!(this._activePlaylist && id !== unprotectString(this._activePlaylist._id))) {
			this.sendStatus()
		}
	}

	sendStatus(): void {
		if (this._ws) {
			this.sendMessage(
				this._activePlaylist
					? literal<PlaylistStatus>({
							id: unprotectString(this._activePlaylist._id),
							name: this._activePlaylist.name,
							active: true,
							rundownIds: this._activePlaylist.rundownIdsInOrder.map((r) => unprotectString(r)),
							currentPartId: this._currentPartId,
							nextPartId: this._nextPartId,
							nextSegmentId: unprotectString(this._activePlaylist.nextSegmentId),
					  })
					: literal<ActiveStatus>({ active: false })
			)
		}
	}

	get playlistsHandler(): PlaylistsHandler {
		return this._playlistsHandler
	}

	subscribe(observer: CollectionObserver<DBRundownPlaylist>): void {
		this._logger.info(`${observer._observerName}' added observer for '${this._name}'`)
		this._playlistObservers.add(observer)
	}

	unsubscribe(observer: CollectionObserver<DBRundownPlaylist>): void {
		this._logger.info(`${observer._observerName}' removed observer for '${this._name}'`)
		this._playlistObservers.delete(observer)
	}

	notify(data: DBRundownPlaylist | undefined): void {
		this._playlistObservers.forEach((o) => o.update(data))
	}

	update(data: DBPartInstance[] | undefined): void {
		this._logger.info(`${this._name} received partInstances update with ${data?.length} parts`)
		if (this._activePlaylist) {
			const currentPartInstance = data?.filter((pi) => pi._id === this._activePlaylist?.currentPartInstanceId)[0]
			const nextPartInstance = data?.filter((pi) => pi._id === this._activePlaylist?.nextPartInstanceId)[0]
			this._currentPartId = currentPartInstance ? unprotectString(currentPartInstance.part._id) : null
			this._nextPartId = nextPartInstance ? unprotectString(nextPartInstance.part._id) : null
			this.sendStatus()
		}
	}
}
