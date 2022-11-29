import { Logger } from 'winston'
import { WebSocket } from 'ws'
import { unprotectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { DBShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { AdLibAction } from '@sofie-automation/corelib/dist/dataModel/AdlibAction'
import { RundownBaselineAdLibAction } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibAction'
import { IBlueprintActionManifestDisplayContent } from '@sofie-automation/blueprints-integration'
import { literal } from '@sofie-automation/shared-lib/dist/lib/lib'
import { WsTopicBase, WsTopic, CollectionObserver } from '../wsHandler'

interface PartStatus {
	id: string
	name: string
	autoNext?: boolean
}

interface AdLibActionType {
	name: string
	label: string
}

interface AdLibActionStatus {
	id: string
	name: string
	sourceLayer: string
	actionType: AdLibActionType[]
}

interface ActivePlaylistStatus {
	event: string
	id: string | null
	name: string
	rundownIds: string[]
	currentPart: PartStatus | null
	nextPart: PartStatus | null
	adlibActions: AdLibActionStatus[]
	globalAdlibActions: AdLibActionStatus[]
}

export class ActivePlaylistTopic
	extends WsTopicBase
	implements
		WsTopic,
		CollectionObserver<DBRundownPlaylist>,
		CollectionObserver<DBPartInstance[]>,
		CollectionObserver<AdLibAction[]>,
		CollectionObserver<RundownBaselineAdLibAction[]>
{
	_observerName = 'ActivePlaylistTopic'
	_sourceLayersMap: Map<string, string> = new Map()
	_activePlaylist: DBRundownPlaylist | undefined
	_currentPartInstance: DBPartInstance | undefined
	_nextPartInstance: DBPartInstance | undefined
	_adLibActions: AdLibAction[] | undefined
	_globalAdLibActions: RundownBaselineAdLibAction[] | undefined

	constructor(logger: Logger) {
		super('ActivePlaylistTopic', logger)
	}

	addSubscriber(ws: WebSocket): void {
		super.addSubscriber(ws)
		this.sendStatus(new Set<WebSocket>().add(ws))
	}

	sendStatus(subscribers: Set<WebSocket>): void {
		const currentPart = this._currentPartInstance ? this._currentPartInstance.part : null
		const nextPart = this._nextPartInstance ? this._nextPartInstance.part : null
		subscribers.forEach((ws) => {
			this.sendMessage(
				ws,
				this._activePlaylist
					? literal<ActivePlaylistStatus>({
							event: 'activePlaylist',
							id: unprotectString(this._activePlaylist._id),
							name: this._activePlaylist.name,
							rundownIds: this._activePlaylist.rundownIdsInOrder.map((r) => unprotectString(r)),
							currentPart: currentPart
								? literal<PartStatus>({
										id: unprotectString(currentPart._id),
										name: currentPart.title,
										autoNext: currentPart.autoNext,
								  })
								: null,
							nextPart: nextPart
								? literal<PartStatus>({
										id: unprotectString(nextPart._id),
										name: nextPart.title,
										autoNext: nextPart.autoNext,
								  })
								: null,
							adlibActions: this._adLibActions
								? this._adLibActions.map((action) => {
										const sourceLayerName = this._sourceLayersMap.get(
											(action.display as IBlueprintActionManifestDisplayContent).sourceLayerId
										)
										const triggerModes = action.triggerModes
											? action.triggerModes.map((t) =>
													literal<AdLibActionType>({
														name: t.data,
														label: t.display.label.key,
													})
											  )
											: []
										return literal<AdLibActionStatus>({
											id: unprotectString(action._id),
											name: action.display.label.key,
											sourceLayer: sourceLayerName ? sourceLayerName : 'invalid',
											actionType: triggerModes,
										})
								  })
								: [],
							globalAdlibActions: this._globalAdLibActions
								? this._globalAdLibActions.map((action) => {
										const sourceLayerName = this._sourceLayersMap.get(
											(action.display as IBlueprintActionManifestDisplayContent).sourceLayerId
										)
										const triggerModes = action.triggerModes
											? action.triggerModes.map((t) =>
													literal<AdLibActionType>({
														name: t.data,
														label: t.display.label.key,
													})
											  )
											: []
										return literal<AdLibActionStatus>({
											id: unprotectString(action._id),
											name: action.display.label.key,
											sourceLayer: sourceLayerName ? sourceLayerName : 'invalid',
											actionType: triggerModes,
										})
								  })
								: [],
					  })
					: literal<ActivePlaylistStatus>({
							event: 'activePlaylist',
							id: null,
							name: 'No Active Playlist',
							rundownIds: [],
							currentPart: null,
							nextPart: null,
							adlibActions: [],
							globalAdlibActions: [],
					  })
			)
		})
	}

	update(
		data:
			| DBRundownPlaylist
			| DBShowStyleBase
			| DBPartInstance[]
			| AdLibAction[]
			| RundownBaselineAdLibAction[]
			| undefined
	): void {
		if (Array.isArray(data)) {
			if (data.length && (data as DBPartInstance[])[0].part !== undefined) {
				const partInstances = data as DBPartInstance[]
				this._logger.info(
					`${this._name} received partInstances update with parts [${partInstances.map((pi) => pi.part._id)}]`
				)
				this._currentPartInstance = partInstances.find(
					(pi) => pi._id === this._activePlaylist?.currentPartInstanceId
				)
				this._nextPartInstance = partInstances.find((pi) => pi._id === this._activePlaylist?.nextPartInstanceId)
			} else if (data.length && (data as AdLibAction[])[0].partId !== undefined) {
				this._adLibActions = data as AdLibAction[]
				this._logger.info(`${this._name} received adLibActions update`)
			} else if (data.length) {
				this._globalAdLibActions = data as RundownBaselineAdLibAction[]
				this._logger.info(`${this._name} received adLibActions update`)
			} else {
				this._logger.error(`${this._name} received unrecognised array update - resetting`)
				this._currentPartInstance = undefined
				this._nextPartInstance = undefined
				this._adLibActions = undefined
				this._globalAdLibActions = undefined
			}
		} else if (data && (data as DBShowStyleBase).sourceLayers !== undefined) {
			const sourceLayers = (data as DBShowStyleBase).sourceLayers
			this._logger.info(
				`${this._name} received showStyleBase update with sourceLayers [${sourceLayers.map((s) => s.name)}]`
			)
			this._sourceLayersMap.clear()
			sourceLayers.forEach((s) => this._sourceLayersMap.set(s._id, s.name))
		} else {
			const rundownPlaylist = data ? (data as DBRundownPlaylist) : undefined
			this._logger.info(
				`${this._name} received playlist update ${rundownPlaylist?._id}, activationId ${rundownPlaylist?.activationId}`
			)
			const activationId = unprotectString(rundownPlaylist?.activationId)
			this._activePlaylist = activationId ? rundownPlaylist : undefined
		}
		process.nextTick(() => this.sendStatus(this._subscribers))
	}
}
