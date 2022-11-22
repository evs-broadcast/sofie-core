import { Logger } from 'winston'
import { CoreHandler } from '../coreHandler'
import { CollectionBase, Collection, CollectionObserver } from '../wsHandler'
import { CoreConnection } from '@sofie-automation/server-core-integration'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { unprotectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'

export class PartHandler
	extends CollectionBase<DBPart>
	implements Collection<DBPart>, CollectionObserver<DBRundownPlaylist>
{
	_observerName: string
	_core: CoreConnection
	_activePlaylist: DBRundownPlaylist | undefined
	_partInstances: DBPartInstance[] | undefined
	_parts: DBPart[] | undefined

	constructor(logger: Logger, coreHandler: CoreHandler) {
		super('PartHandler', 'parts', logger, coreHandler)
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
		this._collectionData = col.findOne(this._collectionData?._id) as unknown as DBPart
		this.notify(this._collectionData)
	}

	update(data: DBRundownPlaylist | DBPartInstance[] | undefined): void {
		const prevPlaylist = this._activePlaylist
		const prevPartInstances = this._partInstances
		if (Array.isArray(data)) {
			this._logger.info(`${this._name} received partInstances update with parts ${data.map((pi) => pi.part._id)}`)
			this._partInstances = data
		} else {
			this._logger.info(`${this._name} received playlist update ${data?._id}`)
			this._activePlaylist = data
		}

		process.nextTick(async () => {
			if (!this._collection) return
			if (prevPlaylist?.rundownIdsInOrder !== this._activePlaylist?.rundownIdsInOrder) {
				if (this._subscriptionId) this._coreHandler.unsubscribe(this._subscriptionId)
				if (this._dbObserver) this._dbObserver.stop()
				if (this._activePlaylist) {
					const rundownIds = this._activePlaylist.rundownIdsInOrder.map((r) => unprotectString(r))
					this._subscriptionId = await this._coreHandler.setupSubscription(
						this._collection,
						rundownIds,
						undefined
					)
					this._dbObserver = this._coreHandler.setupObserver(this._collection)
					this._dbObserver.added = (id: string) => this.changed(id, 'added')
					this._dbObserver.changed = (id: string) => this.changed(id, 'changed')
				}
			}

			if (prevPartInstances !== this._partInstances) {
				this._logger.info(
					`${this._name} found updated partInstances with current part ${this._activePlaylist?.currentPartInstanceId}`
				)
				const col = this._core.getCollection(this._collection)
				if (!col) throw new Error(`collection '${this._collection}' not found!`)
				const currentPartInstance = this._partInstances?.find(
					(pi) => pi._id === this._activePlaylist?.currentPartInstanceId
				)
				this._collectionData = col.findOne(unprotectString(currentPartInstance?.part._id)) as unknown as DBPart
				this.notify(this._collectionData)
			}
		})
	}
}
