import { Logger } from 'winston'
import { CoreHandler } from '../coreHandler'
import { WebSocket } from 'ws'
import { WsHandlerBase, WsHandler, CollectionObserver } from '../wsHandler'
import { CoreConnection, Observer } from '@sofie-automation/server-core-integration'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { literal } from '@sofie-automation/shared-lib/dist/lib/lib'
import { unprotectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'

interface SegmentStatus {
	id: string
	name: string
}

export class SegmentHandler extends WsHandlerBase implements WsHandler, CollectionObserver<DBPartInstance[]> {
	_observerName = 'SegmentHandler'
	_core: CoreConnection
	_studioId: string | undefined
	_subscriptionId: string | undefined
	_collectionObserver: Observer | undefined
	_curRundownId: string | undefined
	_curSegmentId: string | undefined
	_currentSegment: DBSegment | undefined

	constructor(logger: Logger, coreHandler: CoreHandler) {
		super('segment', 'segments', logger, coreHandler)
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
		if (id !== unprotectString(this._currentSegment?._id))
			throw new Error(
				`${this._name} received change with unexpected id ${id} !== ${unprotectString(
					this._currentSegment?._id
				)}`
			)
		if (!this._collection) return
		const col = this._core.getCollection(this._collection)
		if (!col) throw new Error(`collection '${this._collection}' not found!`)
		this._currentSegment = col.findOne(this._curSegmentId) as unknown as DBSegment
		this.sendStatus(this._subscribers)
	}

	sendStatus(subscribers: Set<WebSocket>): void {
		subscribers.forEach((ws) => {
			if (this._currentSegment) {
				this.sendMessage(
					ws,
					literal<SegmentStatus>({
						id: unprotectString(this._currentSegment._id),
						name: this._currentSegment.name,
					})
				)
			}
		})
	}

	update(data: DBPartInstance[] | undefined): void {
		this._logger.info(`${this._name} received partInstances update with parts ${data?.map((pi) => pi.part._id)}`)
		const prevRundownId = this._curRundownId
		const prevSegmentId = this._curSegmentId
		this._curRundownId = data ? unprotectString(data[0].rundownId) : undefined
		this._curSegmentId = data ? unprotectString(data[0].segmentId) : undefined

		process.nextTick(async () => {
			if (!this._collection) return
			if (prevRundownId !== this._curRundownId) {
				if (this._subscriptionId) this._coreHandler.unsubscribe(this._subscriptionId)
				if (this._collectionObserver) this._collectionObserver.stop()
				if (this._curRundownId) {
					this._subscriptionId = await this._coreHandler.setupSubscription(this._collection, {
						rundownId: this._curRundownId,
					})
					this._collectionObserver = this._coreHandler.setupObserver(this._collection)
					this._collectionObserver.added = (id: string) => this.changed(id, 'added')
					this._collectionObserver.changed = (id: string) => this.changed(id, 'changed')
				}
			}

			if (prevSegmentId !== this._curSegmentId) {
				const col = this._core.getCollection(this._collection)
				if (!col) throw new Error(`collection '${this._collection}' not found!`)
				this._currentSegment = col.findOne(this._curSegmentId) as unknown as DBSegment
				this.sendStatus(this._subscribers)
			}
		})
	}
}
