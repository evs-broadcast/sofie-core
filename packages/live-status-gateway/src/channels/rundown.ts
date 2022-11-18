import { Logger } from 'winston'
import { CoreHandler } from '../coreHandler'
import { WebSocket } from 'ws'
import { WsHandlerBase, WsHandler, CollectionObserver } from '../wsHandler'
import { CoreConnection, Observer } from '@sofie-automation/server-core-integration'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { literal } from '@sofie-automation/shared-lib/dist/lib/lib'
import { unprotectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'

interface RundownStatus {
	id: string
	name: string
}

export class RundownHandler
	extends WsHandlerBase
	implements WsHandler, CollectionObserver<DBRundownPlaylist | DBPartInstance[]>
{
	_observerName = 'RundownHandler'
	_core: CoreConnection
	_studioId: string | undefined
	_subscriptionId: string | undefined
	_collectionObserver: Observer | undefined
	_curPlaylistId: string | undefined
	_curRundownId: string | undefined
	_rundown: DBRundown | undefined

	constructor(logger: Logger, coreHandler: CoreHandler) {
		super('rundown', 'rundowns', logger, coreHandler)
		this._core = coreHandler.coreConnection
	}

	async init(): Promise<void> {
		this._studioId = this._coreHandler.studioId
	}

	addSubscriber(ws: WebSocket): void {
		super.addSubscriber(ws)
		this.sendStatus(new Set<WebSocket>().add(ws))
	}

	changed(id: string, changeType: string): void {
		this._logger.info(`${this._name} ${changeType} ${id}`)
		if (id !== this._curRundownId)
			throw new Error(`${this._name} received change with unexpected id ${id} !== ${this._curRundownId}`)
		if (!this._collection) return
		const col = this._core.getCollection(this._collection)
		if (!col) throw new Error(`collection '${this._collection}' not found!`)
		if (this._rundown) this._rundown = col.findOne(this._rundown._id) as unknown as DBRundown
		this.sendStatus(this._subscribers)
	}

	sendStatus(subscribers: Set<WebSocket>): void {
		subscribers.forEach((ws) => {
			if (this._rundown) {
				this.sendMessage(
					ws,
					literal<RundownStatus>({ id: unprotectString(this._rundown._id), name: this._rundown.name })
				)
			}
		})
	}

	update(data: DBRundownPlaylist | DBPartInstance[] | undefined): void {
		const prevPlaylistId = this._curPlaylistId
		const prevRundownId = this._curRundownId
		if (!data) {
			this._logger.info(`${this._name} received update ${data}`)
			this._curPlaylistId = undefined
			return
		}

		if (Array.isArray(data)) {
			this._logger.info(`${this._name} received partInstances update with parts ${data.map((pi) => pi.part._id)}`)
			this._curRundownId = unprotectString(data[0].rundownId)
		} else {
			this._logger.info(`${this._name} received playlist update ${data._id}`)
			this._curPlaylistId = unprotectString(data._id)
		}

		process.nextTick(async () => {
			if (!this._collection) return
			if (prevPlaylistId !== this._curPlaylistId) {
				if (this._subscriptionId) this._coreHandler.unsubscribe(this._subscriptionId)
				if (this._collectionObserver) this._collectionObserver.stop()
				if (this._curPlaylistId) {
					this._subscriptionId = await this._coreHandler.setupSubscription(
						this._collection,
						[this._curPlaylistId],
						undefined
					)
					this._collectionObserver = this._coreHandler.setupObserver(this._collection)
					this._collectionObserver.added = (id: string) => this.changed(id, 'added')
					this._collectionObserver.changed = (id: string) => this.changed(id, 'changed')
				}
			}

			if (prevRundownId !== this._curRundownId) {
				if (this._curRundownId) {
					const col = this._core.getCollection(this._collection)
					if (!col) throw new Error(`collection '${this._collection}' not found!`)
					const rundown = col.findOne(this._curRundownId)
					if (!rundown) throw new Error(`rundown '${this._curRundownId}' not found!`)
					this._rundown = rundown as unknown as DBRundown
				} else this._rundown = undefined
				this.sendStatus(this._subscribers)
			}
		})
	}
}
