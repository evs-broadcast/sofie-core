import { Logger } from 'winston'
import { CoreHandler } from '../coreHandler'
import { CollectionBase, Collection, CollectionObserver } from '../wsHandler'
import { CoreConnection } from '@sofie-automation/server-core-integration'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { unprotectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'

export class RundownHandler
	extends CollectionBase<DBRundown>
	implements Collection<DBRundown>, CollectionObserver<DBRundownPlaylist | DBPartInstance[]>
{
	_observerName: string
	_core: CoreConnection
	_curPlaylistId: string | undefined
	_curRundownId: string | undefined

	constructor(logger: Logger, coreHandler: CoreHandler) {
		super('RundownHandler', 'rundowns', logger, coreHandler)
		this._core = coreHandler.coreConnection
		this._observerName = this._name
	}

	changed(id: string, changeType: string): void {
		this._logger.info(`${this._name} ${changeType} ${id}`)
		if (id !== this._curRundownId)
			throw new Error(`${this._name} received change with unexpected id ${id} !== ${this._curRundownId}`)
		if (!this._collection) return
		const col = this._core.getCollection(this._collection)
		if (!col) throw new Error(`collection '${this._collection}' not found!`)
		if (this._collectionData) this._collectionData = col.findOne(this._collectionData._id) as unknown as DBRundown
	}

	update(data: DBRundownPlaylist | DBPartInstance[] | undefined): void {
		const prevPlaylistId = this._curPlaylistId
		const prevRundownId = this._curRundownId

		if (Array.isArray(data)) {
			this._logger.info(
				`${this._name} received partInstances update with parts [${data.map((pi) => pi.part._id)}]`
			)
			this._curRundownId = unprotectString(data[0].rundownId)
		} else {
			this._logger.info(`${this._name} received playlist update ${data?._id}`)
			this._curPlaylistId = unprotectString(data?._id)
		}

		process.nextTick(async () => {
			if (!this._collection) return
			if (prevPlaylistId !== this._curPlaylistId) {
				if (this._subscriptionId) this._coreHandler.unsubscribe(this._subscriptionId)
				if (this._dbObserver) this._dbObserver.stop()
				if (this._curPlaylistId) {
					this._subscriptionId = await this._coreHandler.setupSubscription(
						this._collection,
						[this._curPlaylistId],
						undefined
					)
					this._dbObserver = this._coreHandler.setupObserver(this._collection)
					this._dbObserver.added = (id: string) => this.changed(id, 'added')
					this._dbObserver.changed = (id: string) => this.changed(id, 'changed')
				}
			}

			if (prevRundownId !== this._curRundownId) {
				if (this._curRundownId) {
					const col = this._core.getCollection(this._collection)
					if (!col) throw new Error(`collection '${this._collection}' not found!`)
					const rundown = col.findOne(this._curRundownId)
					if (!rundown) throw new Error(`rundown '${this._curRundownId}' not found!`)
					this._collectionData = rundown as unknown as DBRundown
				} else this._collectionData = undefined
			}
		})
	}
}
