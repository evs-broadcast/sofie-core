import { Logger } from 'winston'
import { CoreHandler } from '../coreHandler'
import { CollectionBase, Collection, CollectionObserver } from '../wsHandler'
import { CoreConnection } from '@sofie-automation/server-core-integration'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'

export class PartInstancesHandler
	extends CollectionBase<DBPartInstance[]>
	implements Collection<DBPartInstance[]>, CollectionObserver<DBRundownPlaylist>
{
	_observerName: string
	_core: CoreConnection

	constructor(logger: Logger, coreHandler: CoreHandler) {
		super('PartInstancesHandler', 'partInstances', logger, coreHandler)
		this._core = coreHandler.coreConnection
		this._observerName = this._name
	}

	update(data: DBRundownPlaylist | undefined): void {
		this._logger.info(
			`${this._name} received playlist update ${data?._id}, active ${data?.activationId ? true : false}`
		)
		const activePlaylist = data

		process.nextTick(async () => {
			if (!(this._collection && activePlaylist)) return
			const rundownIds = activePlaylist?.rundownIdsInOrder.map((r) => unprotectString(r))
			const activationId = unprotectString(activePlaylist?.activationId)
			if (!activationId) return
			if (this._subscriptionId) this._coreHandler.unsubscribe(this._subscriptionId)
			this._subscriptionId = await this._coreHandler.setupSubscription(this._collection, rundownIds, activationId)
			this._dbObserver = this._coreHandler.setupObserver(this._collection)
			const col = this._core.getCollection(this._collection)
			if (!col) throw new Error(`collection '${this._collection}' not found!`)
			this._collectionData = col.find(undefined) as unknown as DBPartInstance[]
			this.notify(this._collectionData)
		})
	}

	// override notify to implement empty array handling
	notify(data: DBPartInstance[] | undefined): void {
		this._logger.info(`${this._name} notifying playlist update with ${data?.length} partInstances`)
		this._observers.forEach((o) => (data ? o.update(data) : []))
	}
}
