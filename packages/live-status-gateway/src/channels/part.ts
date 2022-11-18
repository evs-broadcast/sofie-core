import { Logger } from 'winston'
import { CoreHandler } from '../coreHandler'
import { WebSocket } from 'ws'
import { WsHandlerBase, WsHandler, CollectionObserver } from '../wsHandler'
import { CoreConnection, Observer } from '@sofie-automation/server-core-integration'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { literal } from '@sofie-automation/shared-lib/dist/lib/lib'
import { unprotectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'

interface PartStatus {
	id: string
	name: string
	tags?: string[]
	autoNext?: boolean
}

export class PartHandler extends WsHandlerBase implements WsHandler, CollectionObserver<DBRundownPlaylist> {
	_observerName = 'PartHandler'
	_core: CoreConnection
	_studioId: string | undefined
	_subscriptionId: string | undefined
	_collectionObserver: Observer | undefined
	_activePlaylist: DBRundownPlaylist | undefined
	_partInstances: DBPartInstance[] | undefined
	_parts: DBPart[] | undefined
	_currentPart: DBPart | undefined

	constructor(logger: Logger, coreHandler: CoreHandler) {
		super('part', 'parts', logger, coreHandler)
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
		if (id !== unprotectString(this._currentPart?._id))
			throw new Error(
				`${this._name} received change with unexpected id ${id} !== ${unprotectString(this._currentPart?._id)}`
			)
		if (!this._collection) return
		const col = this._core.getCollection(this._collection)
		if (!col) throw new Error(`collection '${this._collection}' not found!`)
		if (this._currentPart) this._currentPart = col.findOne(this._currentPart._id) as unknown as DBPart
		this.sendStatus(this._subscribers)
	}

	sendStatus(subscribers: Set<WebSocket>): void {
		subscribers.forEach((ws) => {
			if (this._currentPart) {
				this.sendMessage(
					ws,
					literal<PartStatus>({
						id: unprotectString(this._currentPart._id),
						name: this._currentPart.title,
						tags: this._currentPart.tags,
						autoNext: this._currentPart.autoNext,
					})
				)
			}
		})
	}

	update(data: DBRundownPlaylist | DBPartInstance[] | undefined): void {
		const prevPlaylist = this._activePlaylist
		const prevPartInstances = this._partInstances
		if (!data) {
			this._logger.info(`${this._name} received update ${data}`)
			this._activePlaylist = undefined
			this._partInstances = undefined
		}

		if (Array.isArray(data)) {
			this._logger.info(`${this._name} received partInstances update with parts ${data.map((pi) => pi.part._id)}`)
			this._partInstances = data
		} else if (data) {
			this._logger.info(`${this._name} received playlist update ${data._id}`)
			this._activePlaylist = data
		}

		process.nextTick(async () => {
			if (!this._collection) return
			if (prevPlaylist?.rundownIdsInOrder !== this._activePlaylist?.rundownIdsInOrder) {
				if (this._subscriptionId) this._coreHandler.unsubscribe(this._subscriptionId)
				if (this._collectionObserver) this._collectionObserver.stop()
				if (this._activePlaylist) {
					const rundownIds = this._activePlaylist.rundownIdsInOrder.map((r) => unprotectString(r))
					this._subscriptionId = await this._coreHandler.setupSubscription(
						this._collection,
						rundownIds,
						undefined
					)
					this._collectionObserver = this._coreHandler.setupObserver(this._collection)
					this._collectionObserver.added = (id: string) => this.changed(id, 'added')
					this._collectionObserver.changed = (id: string) => this.changed(id, 'changed')
				}
			}

			if (prevPartInstances !== this._partInstances) {
				this._logger.info(
					`${this._name} found updated partInstances ${this._activePlaylist?.currentPartInstanceId}`
				)
				const col = this._core.getCollection(this._collection)
				if (!col) throw new Error(`collection '${this._collection}' not found!`)
				const currentPartInstance = this._partInstances?.find(
					(pi) => pi._id === this._activePlaylist?.currentPartInstanceId
				)
				this._currentPart = col.findOne(unprotectString(currentPartInstance?.part._id)) as unknown as DBPart
				this.sendStatus(this._subscribers)
			}
		})
	}
}
