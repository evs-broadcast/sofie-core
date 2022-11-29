import { Logger } from 'winston'
import { CoreHandler } from '../coreHandler'
import { CollectionBase, Collection, CollectionObserver } from '../wsHandler'
import { CoreConnection } from '@sofie-automation/server-core-integration'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { unprotectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'

export class SegmentHandler
	extends CollectionBase<DBSegment>
	implements Collection<DBSegment>, CollectionObserver<DBPartInstance[]>
{
	_observerName: string
	_core: CoreConnection
	_curRundownId: string | undefined
	_curSegmentId: string | undefined

	constructor(logger: Logger, coreHandler: CoreHandler) {
		super('SegmentHandler', 'segments', logger, coreHandler)
		this._core = coreHandler.coreConnection
		this._observerName = this._name
	}

	changed(id: string, changeType: string): void {
		this._logger.info(`${this._name} ${changeType} ${id}`)
		if (id !== unprotectString(this._collectionData?._id))
			throw new Error(
				`${this._name} received change with unexpected id ${id} !== ${unprotectString(
					this._collectionData?._id
				)}`
			)
		if (!this._collection) return
		const col = this._core.getCollection(this._collection)
		if (!col) throw new Error(`collection '${this._collection}' not found!`)
		this._collectionData = col.findOne(this._curSegmentId) as unknown as DBSegment
		this.notify(this._collectionData)
	}

	update(data: DBPartInstance[] | undefined): void {
		this._logger.info(`${this._name} received partInstances update with parts [${data?.map((pi) => pi.part._id)}]`)
		const prevRundownId = this._curRundownId
		const prevSegmentId = this._curSegmentId
		this._curRundownId = data ? unprotectString(data[0].rundownId) : undefined
		this._curSegmentId = data ? unprotectString(data[0].segmentId) : undefined

		process.nextTick(async () => {
			if (!this._collection) return
			if (prevRundownId !== this._curRundownId) {
				if (this._subscriptionId) this._coreHandler.unsubscribe(this._subscriptionId)
				if (this._dbObserver) this._dbObserver.stop()
				if (this._curRundownId) {
					this._subscriptionId = await this._coreHandler.setupSubscription(this._collection, {
						rundownId: this._curRundownId,
					})
					this._dbObserver = this._coreHandler.setupObserver(this._collection)
					this._dbObserver.added = (id: string) => this.changed(id, 'added')
					this._dbObserver.changed = (id: string) => this.changed(id, 'changed')
				}
			}

			if (prevSegmentId !== this._curSegmentId) {
				const col = this._core.getCollection(this._collection)
				if (!col) throw new Error(`collection '${this._collection}' not found!`)
				this._collectionData = col.findOne(this._curSegmentId) as unknown as DBSegment
				this.notify(this._collectionData)
			}
		})
	}
}
