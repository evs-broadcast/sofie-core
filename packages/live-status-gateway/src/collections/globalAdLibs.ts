import { Logger } from 'winston'
import { CoreHandler } from '../coreHandler'
import { CollectionBase, Collection, CollectionObserver } from '../wsHandler'
import { CoreConnection } from '@sofie-automation/server-core-integration'
import { RundownBaselineAdLibItem } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibPiece'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { unprotectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { PartInstanceName } from './partInstances'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'

export class GlobalAdLibsHandler
	extends CollectionBase<RundownBaselineAdLibItem[]>
	implements
		Collection<RundownBaselineAdLibItem[]>,
		CollectionObserver<Map<PartInstanceName, DBPartInstance | undefined>>
{
	public observerName: string
	private _core: CoreConnection
	private _curRundownId: string | undefined

	constructor(logger: Logger, coreHandler: CoreHandler) {
		super(
			'GlobalAdLibHandler',
			CollectionName.RundownBaselineAdLibPieces,
			'rundownBaselineAdLibPieces',
			logger,
			coreHandler
		)
		this._core = coreHandler.coreConnection
		this.observerName = this._name
	}

	async changed(id: string, changeType: string): Promise<void> {
		this._logger.info(`${this._name} ${changeType} ${id}`)
		if (!this._collection) return
		const col = this._core.getCollection<RundownBaselineAdLibItem>(this._collection)
		if (!col) throw new Error(`collection '${this._collection}' not found!`)
		this._collectionData = col.find({ rundownId: this._curRundownId })
		await this.notify(this._collectionData)
	}

	async update(source: string, data: Map<PartInstanceName, DBPartInstance | undefined> | undefined): Promise<void> {
		this._logger.info(`${this._name} received globalAdLibs update from ${source}`)
		const prevRundownId = this._curRundownId
		const partInstance = data ? data.get(PartInstanceName.current) ?? data.get(PartInstanceName.next) : undefined
		this._curRundownId = partInstance ? unprotectString(partInstance.rundownId) : undefined

		await new Promise(process.nextTick.bind(this))
		if (!this._collection) return
		if (!this._publication) return
		if (prevRundownId !== this._curRundownId) {
			if (this._subscriptionId) this._coreHandler.unsubscribe(this._subscriptionId)
			if (this._dbObserver) this._dbObserver.stop()
			if (this._curRundownId) {
				this._subscriptionId = await this._coreHandler.setupSubscription(this._publication, {
					rundownId: this._curRundownId,
				})
				this._dbObserver = this._coreHandler.setupObserver(this._collection)
				this._dbObserver.added = (id: string) => {
					void this.changed(id, 'added').catch(this._logger.error)
				}
				this._dbObserver.changed = (id: string) => {
					void this.changed(id, 'changed').catch(this._logger.error)
				}

				const col = this._core.getCollection<RundownBaselineAdLibItem>(this._collection)
				if (!col) throw new Error(`collection '${this._collection}' not found!`)
				this._collectionData = col.find({ rundownId: this._curRundownId })
				await this.notify(this._collectionData)
			}
		}
	}

	// override notify to implement empty array handling
	async notify(data: RundownBaselineAdLibItem[] | undefined): Promise<void> {
		this._logger.info(`${this._name} notifying update with ${data?.length} globalAdLibs`)
		if (data !== undefined) {
			for (const observer of this._observers) {
				await observer.update(this._name, data)
			}
		}
	}
}
