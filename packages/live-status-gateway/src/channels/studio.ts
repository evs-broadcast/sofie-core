import { Logger } from 'winston'
import { CoreHandler } from '../coreHandler'
import { WebSocket } from 'ws'
import { WsHandlerBase, WsHandler, CollectionObserver } from '../wsHandler'
import { CoreConnection } from '@sofie-automation/server-core-integration'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { literal } from '@sofie-automation/shared-lib/dist/lib/lib'
import { unprotectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'

interface StudioStatus {
	id: string
	name: string
	playlists: { id: string; name: string }[] | undefined
}

export class StudioHandler extends WsHandlerBase implements WsHandler, CollectionObserver<DBRundownPlaylist[]> {
	_observerName = 'StudioHandler'
	_core: CoreConnection
	_studioId: string | undefined
	_subscriptionId: string | undefined
	_studio: DBStudio | undefined
	_playlists: DBRundownPlaylist[] | undefined

	constructor(logger: Logger, coreHandler: CoreHandler) {
		super('studio', 'studios', logger, coreHandler)
		this._core = coreHandler.coreConnection
	}

	async init(): Promise<void> {
		this._studioId = this._coreHandler.studioId
		if (!(this._studioId && this._collection)) return
		this._subscriptionId = await this._coreHandler.setupSubscription(this._collection, { _id: this._studioId })
		const observer = this._coreHandler.setupObserver(this._collection)

		if (this._collection) {
			// query for the studio information
			const col = this._core.getCollection(this._collection)
			if (!col) throw new Error(`collection '${this._collection}' not found!`)
			const studio = col.findOne(this._studioId)
			if (!studio) throw new Error(`studio '${this._studioId}' not found!`)
			this._studio = studio as unknown as DBStudio
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
		if (!(id === this._studioId && this._collection)) return
		const col = this._core.getCollection(this._collection)
		if (!col) throw new Error(`collection '${this._collection}' not found!`)
		const studio = col.findOne(id)
		if (!studio) throw new Error(`studio '${this._studioId}' not found on changed!`)
		this._studio = studio as unknown as DBStudio
		this.sendStatus()
	}

	// setPlaylists(playlists: DBRundownPlaylist[]): void {
	// 	this._playlists = playlists
	// }

	sendStatus(): void {
		if (this._ws && this._studio)
			this.sendMessage(
				literal<StudioStatus>({
					id: unprotectString(this._studio._id),
					name: this._studio.name,
					playlists: this._playlists?.map((p) => {
						return { id: unprotectString(p._id), name: p.name }
					}),
				})
			)
	}

	async update(data: DBRundownPlaylist[] | undefined): Promise<void> {
		this._logger.info(`${this._name} received playlists update`)
		this._playlists = data
		this.sendStatus()
	}
}
