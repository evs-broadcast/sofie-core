import { Logger } from 'winston'
import { CoreHandler } from '../coreHandler'
import { WebSocket } from 'ws'
import { WsHandlerBase, WsHandler } from '../wsHandler'
import { CoreConnection } from '@sofie-automation/server-core-integration'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { literal } from '@sofie-automation/shared-lib/dist/lib/lib'
import { unprotectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { StudioHandler } from './studio'

interface PlaylistStatus {
	id: string
	name: string
}

export class PlaylistHandler extends WsHandlerBase implements WsHandler {
	_core: CoreConnection
	_studioHandler: StudioHandler
	_studioId: string | undefined
	_playlists: DBRundownPlaylist[] = []
	_activePlaylist: DBRundownPlaylist | undefined

	constructor(logger: Logger, coreHandler: CoreHandler, studioHandler: StudioHandler) {
		super('playlists', 'rundownPlaylists', logger, coreHandler)
		this._core = coreHandler.coreConnection
		this._studioHandler = studioHandler
	}

	async init(): Promise<void> {
		this._studioId = this._coreHandler.studioId
		if (!(this._studioId && this._collection)) return
		const observer = await this._coreHandler.setSubscription(this._collection, { studioId: this._studioId })
		if (this._collection) {
			const col = this._core.getCollection(this._collection)
			if (!col) throw new Error(`collection '${this._collection}' not found!`)
			this._playlists = col.find(undefined) as unknown as DBRundownPlaylist[]
			this._studioHandler.setPlaylists(this._playlists)
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
			this._studioHandler.setPlaylists(this._playlists)
		}
		this.sendStatus()
	}

	sendStatus(): void {
		this._activePlaylist = this._playlists.find((p) => p.activationId)
		if (this._ws && this._activePlaylist)
			this.sendMessage(
				literal<PlaylistStatus>({
					id: unprotectString(this._activePlaylist._id),
					name: this._activePlaylist.name,
				})
			)
	}
}
