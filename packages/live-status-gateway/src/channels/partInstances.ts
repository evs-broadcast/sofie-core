import { Logger } from 'winston'
import { CoreHandler } from '../coreHandler'
import { WsHandlerBase, WsHandler, CollectionData, CollectionObserver } from '../wsHandler'
import { CoreConnection } from '@sofie-automation/server-core-integration'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'

export class PartInstancesHandler
	extends WsHandlerBase
	implements WsHandler, CollectionData<DBPartInstance[]>, CollectionObserver<DBRundownPlaylist>
{
	_observerName = 'PartInstancesHandler'
	_core: CoreConnection
	_studioId: string | undefined
	_subscriptionId: string | undefined
	_activePlaylist: DBRundownPlaylist | undefined
	_partInstances: DBPartInstance[] | undefined
	_partInstanceObservers: Set<CollectionObserver<DBPartInstance[]>> = new Set()

	constructor(logger: Logger, coreHandler: CoreHandler) {
		super('partInstance', 'partInstances', logger, coreHandler)
		this._core = coreHandler.coreConnection
	}

	async init(): Promise<void> {
		this._studioId = this._coreHandler.studioId
	}

	subscribe(observer: CollectionObserver<DBPartInstance[]>): void {
		this._logger.info(`${observer._observerName}' added observer for '${this._name}'`)
		this._partInstanceObservers.add(observer)
	}

	unsubscribe(observer: CollectionObserver<DBPartInstance[]>): void {
		this._logger.info(`${observer._observerName}' removed observer for '${this._name}'`)
		this._partInstanceObservers.delete(observer)
	}

	notify(data: DBPartInstance[] | undefined): void {
		this._partInstanceObservers.forEach((o) => o.update(data))
	}

	update(data: DBRundownPlaylist | undefined): void {
		this._logger.info(`${this._name} received playlist update ${data}`)
		this._activePlaylist = data

		process.nextTick(async () => {
			if (!(this._collection && this._activePlaylist)) return
			const rundownIds = this._activePlaylist?.rundownIdsInOrder.map((r) => unprotectString(r))
			const activationId = unprotectString(this._activePlaylist?.activationId)
			if (!activationId) return
			if (this._subscriptionId) this._coreHandler.unsubscribe(this._subscriptionId)
			this._subscriptionId = await this._coreHandler.setupSubscription(this._collection, rundownIds, activationId)
			/*const observer =*/ this._coreHandler.setupObserver(this._collection)
			const col = this._core.getCollection(this._collection)
			if (!col) throw new Error(`collection '${this._collection}' not found!`)
			this._partInstances = col.find(undefined) as unknown as DBPartInstance[]
			this.notify(this._partInstances)
		})
	}
}
