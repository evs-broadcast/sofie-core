import { Logger } from 'winston'
import { WebSocket } from 'ws'
import { unprotectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { DBShowStyleBase, OutputLayers, SourceLayers } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { AdLibAction } from '@sofie-automation/corelib/dist/dataModel/AdlibAction'
import { RundownBaselineAdLibAction } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibAction'
import { RundownBaselineAdLibItem } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibPiece'
import { IBlueprintActionManifestDisplayContent } from '@sofie-automation/blueprints-integration'
import { literal } from '@sofie-automation/shared-lib/dist/lib/lib'
import { WsTopicBase, WsTopic, CollectionObserver } from '../wsHandler'
import { PartInstanceName } from '../collections/partInstances'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'

interface PartStatus {
	id: string
	name: string
	autoNext?: boolean
}

interface AdLibActionType {
	name: string
	label: string
}

interface AdLibStatus {
	id: string
	name: string
	sourceLayer: string
	outputLayer: string
	actionType: AdLibActionType[]
}

interface ActivePlaylistStatus {
	event: string
	id: string | null
	name: string
	rundownIds: string[]
	currentPart: PartStatus | null
	nextPart: PartStatus | null
	adLibs: AdLibStatus[]
	globalAdLibs: AdLibStatus[]
}

export class ActivePlaylistTopic
	extends WsTopicBase
	implements
		WsTopic,
		CollectionObserver<DBRundownPlaylist>,
		CollectionObserver<Map<PartInstanceName, DBPartInstance | undefined>>,
		CollectionObserver<AdLibAction[]>,
		CollectionObserver<RundownBaselineAdLibAction[]>
{
	_observerName = 'ActivePlaylistTopic'
	_sourceLayersMap: Map<string, string> = new Map()
	_outputLayersMap: Map<string, string> = new Map()
	_activePlaylist: DBRundownPlaylist | undefined
	_currentPartInstance: DBPartInstance | undefined
	_nextPartInstance: DBPartInstance | undefined
	_adLibActions: AdLibAction[] | undefined
	_abLibs: AdLibPiece[] | undefined
	_globalAdLibActions: RundownBaselineAdLibAction[] | undefined
	_globalAdLibs: RundownBaselineAdLibItem[] | undefined

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
		const adLibs: AdLibStatus[] = []
		const globalAdLibs: AdLibStatus[] = []

		if (this._adLibActions) {
			adLibs.push(
				...this._adLibActions.map((action) => {
					const sourceLayerName = this._sourceLayersMap.get(
						(action.display as IBlueprintActionManifestDisplayContent).sourceLayerId
					)
					const outputLayerName = this._outputLayersMap.get(
						(action.display as IBlueprintActionManifestDisplayContent).outputLayerId
					)
					const triggerModes = action.triggerModes
						? action.triggerModes.map((t) =>
								literal<AdLibActionType>({
									name: t.data,
									label: t.display.label.key,
								})
						  )
						: []
					return literal<AdLibStatus>({
						id: unprotectString(action._id),
						name: action.display.label.key,
						sourceLayer: sourceLayerName ? sourceLayerName : 'invalid',
						outputLayer: outputLayerName ? outputLayerName : 'invalid',
						actionType: triggerModes,
					})
				})
			)
		}

		if (this._abLibs) {
			adLibs.push(
				...this._abLibs.map((adLib) => {
					const sourceLayerName = this._sourceLayersMap.get(adLib.sourceLayerId)
					const outputLayerName = this._outputLayersMap.get(adLib.outputLayerId)
					return literal<AdLibStatus>({
						id: unprotectString(adLib._id),
						name: adLib.name,
						sourceLayer: sourceLayerName ? sourceLayerName : 'invalid',
						outputLayer: outputLayerName ? outputLayerName : 'invalid',
						actionType: [],
					})
				})
			)
		}

		if (this._globalAdLibActions) {
			globalAdLibs.push(
				...this._globalAdLibActions.map((action) => {
					const sourceLayerName = this._sourceLayersMap.get(
						(action.display as IBlueprintActionManifestDisplayContent).sourceLayerId
					)
					const outputLayerName = this._outputLayersMap.get(
						(action.display as IBlueprintActionManifestDisplayContent).outputLayerId
					)
					const triggerModes = action.triggerModes
						? action.triggerModes.map((t) =>
								literal<AdLibActionType>({
									name: t.data,
									label: t.display.label.key,
								})
						  )
						: []
					return literal<AdLibStatus>({
						id: unprotectString(action._id),
						name: action.display.label.key,
						sourceLayer: sourceLayerName ? sourceLayerName : 'invalid',
						outputLayer: outputLayerName ? outputLayerName : 'invalid',
						actionType: triggerModes,
					})
				})
			)
		}

		if (this._globalAdLibs) {
			globalAdLibs.push(
				...this._globalAdLibs.map((adLibs) => {
					const sourceLayerName = this._sourceLayersMap.get(adLibs.sourceLayerId)
					const outputLayerName = this._outputLayersMap.get(adLibs.outputLayerId)
					return literal<AdLibStatus>({
						id: unprotectString(adLibs._id),
						name: adLibs.name,
						sourceLayer: sourceLayerName ? sourceLayerName : 'invalid',
						outputLayer: outputLayerName ? outputLayerName : 'invalid',
						actionType: [],
					})
				})
			)
		}

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
							adLibs,
							globalAdLibs,
					  })
					: literal<ActivePlaylistStatus>({
							event: 'activePlaylist',
							id: null,
							name: '',
							rundownIds: [],
							currentPart: null,
							nextPart: null,
							adLibs: [],
							globalAdLibs: [],
					  })
			)
		})
	}

	update(
		source: string,
		data:
			| DBRundownPlaylist
			| DBShowStyleBase
			| Map<PartInstanceName, DBPartInstance | undefined>
			| AdLibAction[]
			| RundownBaselineAdLibAction[]
			| AdLibPiece[]
			| RundownBaselineAdLibItem[]
			| undefined
	): void {
		const rundownPlaylist = data ? (data as DBRundownPlaylist) : undefined
		const sourceLayers: SourceLayers = data
			? applyAndValidateOverrides((data as DBShowStyleBase).sourceLayersWithOverrides).obj
			: {}
		const outputLayers: OutputLayers = data
			? applyAndValidateOverrides((data as DBShowStyleBase).outputLayersWithOverrides).obj
			: {}
		const partInstances = data as Map<PartInstanceName, DBPartInstance | undefined>
		const adLibActions = data ? (data as AdLibAction[]) : []
		const globalAdLibActions = data ? (data as RundownBaselineAdLibAction[]) : []
		switch (source) {
			case 'PlaylistHandler':
				this._logger.info(
					`${this._name} received playlist update ${rundownPlaylist?._id}, activationId ${rundownPlaylist?.activationId}`
				)
				this._activePlaylist = unprotectString(rundownPlaylist?.activationId) ? rundownPlaylist : undefined
				break
			case 'ShowStyleBaseHandler':
				this._logger.info(
					`${this._name} received showStyleBase update with sourceLayers [${Object.values(sourceLayers).map(
						(s) => s!.name
					)}]`
				)
				this._logger.info(
					`${this._name} received showStyleBase update with outputLayers [${Object.values(outputLayers).map(
						(s) => s!.name
					)}]`
				)
				this._sourceLayersMap.clear()
				this._outputLayersMap.clear()
				for (const [layerId, sourceLayer] of Object.entries(sourceLayers)) {
					if (sourceLayer === undefined || sourceLayer === null) continue
					this._sourceLayersMap.set(layerId, sourceLayer.name)
				}
				for (const [layerId, outputLayer] of Object.entries(outputLayers)) {
					if (outputLayer === undefined || outputLayer === null) continue
					this._outputLayersMap.set(layerId, outputLayer.name)
				}
				break
			case 'PartInstancesHandler':
				this._logger.info(`${this._name} received partInstances update from ${source}`)
				this._currentPartInstance = partInstances.get(PartInstanceName.current)
				this._nextPartInstance = partInstances.get(PartInstanceName.next)
				break
			case 'AdLibActionHandler':
				this._logger.info(`${this._name} received adLibActions update from ${source}`)
				this._adLibActions = adLibActions
				break
			case 'GlobalAdLibActionHandler':
				this._logger.info(`${this._name} received globalAdLibActions update from ${source}`)
				this._globalAdLibActions = globalAdLibActions
				break
			default:
				throw new Error(`${this._name} received unsupported update from ${source}}`)
		}

		this.sendStatus(this._subscribers)
	}
}
