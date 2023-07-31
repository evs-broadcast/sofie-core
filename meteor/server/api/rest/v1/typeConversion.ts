import {
	BlueprintManifestType,
	IBlueprintConfig,
	IOutputLayer,
	ISourceLayer,
	SourceLayerType,
	StatusCode,
	TSR,
} from '@sofie-automation/blueprints-integration'
import {
	PERIPHERAL_SUBTYPE_PROCESS,
	PeripheralDevice,
	PeripheralDeviceType,
} from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { Blueprint } from '@sofie-automation/corelib/dist/dataModel/Blueprint'
import { ShowStyleBaseId, ShowStyleVariantId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBStudio, IStudioSettings, StudioPlayoutDevice } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { assertNever, getRandomId, literal } from '@sofie-automation/corelib/dist/lib'
import { protectString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import {
	applyAndValidateOverrides,
	ObjectOverrideSetOp,
	wrapDefaultObject,
	updateOverrides,
	ObjectWithOverrides,
} from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import {
	APIBlueprint,
	APIOutputLayer,
	APIPeripheralDevice,
	APIShowStyleBase,
	APIShowStyleVariant,
	APISourceLayer,
	APIStudio,
	APIStudioSettings,
} from '../../../../lib/api/rest'
import { DBShowStyleBase, ShowStyleBase } from '../../../../lib/collections/ShowStyleBases'
import { ShowStyleVariant } from '../../../../lib/collections/ShowStyleVariants'
import { Studio } from '../../../../lib/collections/Studios'
import { Blueprints, PeripheralDevices, ShowStyleBases, Studios } from '../../../collections'

/*
This file contains functions that convert between the internal Sofie-Core types and types exposed to the external API.
When making changes to this file, be wary of breaking changes to the API.
*/

export async function showStyleBaseFrom(
	apiShowStyleBase: APIShowStyleBase,
	existingId?: ShowStyleBaseId
): Promise<ShowStyleBase | undefined> {
	const blueprint = await Blueprints.findOneAsync(protectString(apiShowStyleBase.blueprintId))
	if (!blueprint) return undefined
	if (blueprint.blueprintType !== BlueprintManifestType.SHOWSTYLE) return undefined

	let showStyleBase: DBShowStyleBase | undefined
	if (existingId) showStyleBase = await ShowStyleBases.findOneAsync(existingId)

	const newOutputLayers = apiShowStyleBase.outputLayers.reduce<Record<string, IOutputLayer>>((acc, op) => {
		acc[op.id] = { _id: op.id, name: op.name, _rank: op.rank, isPGM: op.isPgm }
		return acc
	}, {} as Record<string, IOutputLayer>)
	const outputLayers = showStyleBase
		? updateOverrides(showStyleBase.outputLayersWithOverrides, newOutputLayers)
		: wrapDefaultObject({})

	const newSourceLayers = apiShowStyleBase.sourceLayers.reduce<Record<string, ISourceLayer>>((acc, op) => {
		acc[op.id] = sourceLayerFrom(op)
		return acc
	}, {} as Record<string, ISourceLayer>)
	const sourceLayers = showStyleBase
		? updateOverrides(showStyleBase.sourceLayersWithOverrides, newSourceLayers)
		: wrapDefaultObject({})

	const blueprintConfig = showStyleBase
		? updateOverrides(showStyleBase.blueprintConfigWithOverrides, apiShowStyleBase.config as IBlueprintConfig)
		: wrapDefaultObject({})

	return {
		_id: existingId ?? getRandomId(),
		name: apiShowStyleBase.name,
		blueprintId: protectString(apiShowStyleBase.blueprintId),
		blueprintConfigPresetId: apiShowStyleBase.blueprintConfigPresetId,
		organizationId: null,
		outputLayersWithOverrides: outputLayers,
		sourceLayersWithOverrides: sourceLayers,
		blueprintConfigWithOverrides: blueprintConfig,
		_rundownVersionHash: '',
		lastBlueprintConfig: undefined,
	}
}

export function APIShowStyleBaseFrom(showStyleBase: ShowStyleBase): APIShowStyleBase {
	return {
		name: showStyleBase.name,
		blueprintId: unprotectString(showStyleBase.blueprintId),
		blueprintConfigPresetId: showStyleBase.blueprintConfigPresetId,
		outputLayers: Object.values<IOutputLayer | undefined>(
			applyAndValidateOverrides(showStyleBase.outputLayersWithOverrides).obj
		).map((layer) => APIOutputLayerFrom(layer!)),
		sourceLayers: Object.values<ISourceLayer | undefined>(
			applyAndValidateOverrides(showStyleBase.sourceLayersWithOverrides).obj
		).map((layer) => APISourceLayerFrom(layer!)),
		config: applyAndValidateOverrides(showStyleBase.blueprintConfigWithOverrides).obj,
	}
}

export function showStyleVariantFrom(
	apiShowStyleVariant: APIShowStyleVariant,
	existingId?: ShowStyleVariantId
): ShowStyleVariant | undefined {
	const blueprintConfig = wrapDefaultObject({})
	blueprintConfig.overrides = Object.entries<any>(apiShowStyleVariant.config).map(([key, value]) =>
		literal<ObjectOverrideSetOp>({
			op: 'set',
			path: key,
			value,
		})
	)
	return {
		_id: existingId ?? getRandomId(),
		_rank: apiShowStyleVariant.rank,
		showStyleBaseId: protectString(apiShowStyleVariant.showStyleBaseId),
		name: apiShowStyleVariant.name,
		blueprintConfigWithOverrides: blueprintConfig,
		_rundownVersionHash: '',
	}
}

export function APIShowStyleVariantFrom(showStyleVariant: ShowStyleVariant): APIShowStyleVariant {
	return {
		name: showStyleVariant.name,
		rank: showStyleVariant._rank,
		showStyleBaseId: unprotectString(showStyleVariant.showStyleBaseId),
		config: applyAndValidateOverrides(showStyleVariant.blueprintConfigWithOverrides).obj,
	}
}

export function sourceLayerFrom(apiSourceLayer: APISourceLayer): ISourceLayer {
	let layerType: SourceLayerType
	switch (apiSourceLayer.layerType) {
		case 'audio':
			layerType = SourceLayerType.AUDIO
			break
		case 'camera':
			layerType = SourceLayerType.CAMERA
			break
		case 'graphics':
			layerType = SourceLayerType.GRAPHICS
			break
		case 'live-speak':
			layerType = SourceLayerType.LIVE_SPEAK
			break
		case 'local':
			layerType = SourceLayerType.LOCAL
			break
		case 'lower-third':
			layerType = SourceLayerType.LOWER_THIRD
			break
		case 'remote':
			layerType = SourceLayerType.REMOTE
			break
		case 'script':
			layerType = SourceLayerType.SCRIPT
			break
		case 'splits':
			layerType = SourceLayerType.SPLITS
			break
		case 'transition':
			layerType = SourceLayerType.TRANSITION
			break
		case 'unknown':
			layerType = SourceLayerType.UNKNOWN
			break
		case 'vt':
			layerType = SourceLayerType.VT
			break
		default:
			layerType = SourceLayerType.UNKNOWN
			assertNever(apiSourceLayer.layerType)
	}

	return {
		_id: apiSourceLayer.id,
		name: apiSourceLayer.name,
		abbreviation: apiSourceLayer.abbreviation,
		_rank: apiSourceLayer.rank,
		type: layerType,
		exclusiveGroup: apiSourceLayer.exclusiveGroup,
	}
}

export function APISourceLayerFrom(sourceLayer: ISourceLayer): APISourceLayer {
	let layerType: APISourceLayer['layerType']
	switch (sourceLayer.type) {
		case SourceLayerType.AUDIO:
			layerType = 'audio'
			break
		case SourceLayerType.CAMERA:
			layerType = 'camera'
			break
		case SourceLayerType.GRAPHICS:
			layerType = 'graphics'
			break
		case SourceLayerType.LIVE_SPEAK:
			layerType = 'live-speak'
			break
		case SourceLayerType.LOCAL:
			layerType = 'local'
			break
		case SourceLayerType.LOWER_THIRD:
			layerType = 'lower-third'
			break
		case SourceLayerType.REMOTE:
			layerType = 'remote'
			break
		case SourceLayerType.SCRIPT:
			layerType = 'script'
			break
		case SourceLayerType.SPLITS:
			layerType = 'splits'
			break
		case SourceLayerType.TRANSITION:
			layerType = 'transition'
			break
		case SourceLayerType.UNKNOWN:
			layerType = 'unknown'
			break
		case SourceLayerType.VT:
			layerType = 'vt'
			break
		default:
			layerType = 'unknown'
			assertNever(sourceLayer.type)
	}

	return {
		id: sourceLayer._id,
		name: sourceLayer.name,
		abbreviation: sourceLayer.abbreviation,
		rank: sourceLayer._rank,
		layerType,
		exclusiveGroup: sourceLayer.exclusiveGroup,
	}
}

export async function studioFrom(apiStudio: APIStudio, existingId?: StudioId): Promise<Studio | undefined> {
	let blueprint: Blueprint | undefined
	if (apiStudio.blueprintId) {
		blueprint = await Blueprints.findOneAsync(protectString(apiStudio.blueprintId))
		if (!blueprint) return undefined
		if (blueprint.blueprintType !== BlueprintManifestType.STUDIO) return undefined
	}

	let studio: DBStudio | undefined
	if (existingId) studio = await Studios.findOneAsync(existingId)

	const blueprintConfig = studio
		? updateOverrides(studio.blueprintConfigWithOverrides, apiStudio.config as IBlueprintConfig)
		: wrapDefaultObject({})

	const playoutGateways = (
		await PeripheralDevices.findFetchAsync(
			{ studioId: existingId },
			{ projection: { _id: 1, category: 1, type: 1, subType: 1 } }
		)
	).filter((d) => d.category === 'playout' && d.type === 'playout' && d.subType === PERIPHERAL_SUBTYPE_PROCESS)
	console.log(`playoutGateways: ${JSON.stringify(playoutGateways, null, 2)}`)

	const peripheralDeviceSettings = studio?.peripheralDeviceSettings
	console.log(`peripheralDeviceSettings: ${JSON.stringify(peripheralDeviceSettings, null, 2)}`)

	// All must move to applyConfig in blueprints - here only for testing
	// setup any device services from the blueprint config, adding peripheral devices and studio settings as required
	const playoutDevices: ObjectWithOverrides<Record<string, StudioPlayoutDevice>> = wrapDefaultObject({})
	playoutDevices.overrides = Object.entries<any>(applyAndValidateOverrides(blueprintConfig).obj)
		.filter(([key, _value]) => {
			return key === 'deviceServices'
		})
		.map(([_key, value]) => value[0])
		.map((dsomConfig) => {
			const dsomOptions: TSR.DeviceOptionsDSOM = {
				type: TSR.DeviceType.DSOM,
				isMultiThreaded: false,
				reportAllCommands: false,
				options: {
					url: dsomConfig.address,
					username: dsomConfig.username,
					password: dsomConfig.password,
					studioDevices: [],
				},
			}
			const dsomDevice: StudioPlayoutDevice = {
				peripheralDeviceId: playoutGateways[0]._id,
				options: dsomOptions,
			}

			return literal<ObjectOverrideSetOp>({
				op: 'set',
				path: dsomConfig.objectId,
				value: dsomDevice,
			})
		})
	// console.log(`playoutDevices overrides: ${JSON.stringify(playoutDevices.overrides, null, 2)}`)

	if (existingId && studio) {
		studio.peripheralDeviceSettings = {
			playoutDevices: playoutDevices,
			ingestDevices: wrapDefaultObject({}),
			inputDevices: wrapDefaultObject({}),
		}
		await Studios.upsertAsync(existingId, studio)
	}

	return {
		_id: existingId ?? getRandomId(),
		name: apiStudio.name,
		blueprintId: blueprint?._id,
		blueprintConfigPresetId: apiStudio.blueprintConfigPresetId,
		blueprintConfigWithOverrides: blueprintConfig,
		settings: studioSettingsFrom(apiStudio.settings),
		supportedShowStyleBase: apiStudio.supportedShowStyleBase?.map((id) => protectString<ShowStyleBaseId>(id)) ?? [],
		organizationId: null,
		mappingsWithOverrides: wrapDefaultObject({}),
		routeSets: {},
		_rundownVersionHash: '',
		routeSetExclusivityGroups: {},
		packageContainers: {},
		previewContainerIds: [],
		thumbnailContainerIds: [],
		peripheralDeviceSettings: {
			playoutDevices: wrapDefaultObject({}), //playoutDevices,
			ingestDevices: wrapDefaultObject({}),
			inputDevices: wrapDefaultObject({}),
		},
		lastBlueprintConfig: undefined,
	}
}

export function APIStudioFrom(studio: Studio): APIStudio {
	const studioSettings = APIStudioSettingsFrom(studio.settings)

	Object.entries<any>(studio.peripheralDeviceSettings).forEach(([key, value]) => {
		console.log(`Peripheral Devices - ${key}: ${JSON.stringify(value, null, 2)}`)
	})

	return {
		name: studio.name,
		blueprintId: unprotectString(studio.blueprintId),
		blueprintConfigPresetId: studio.blueprintConfigPresetId,
		config: applyAndValidateOverrides(studio.blueprintConfigWithOverrides).obj,
		settings: studioSettings,
		supportedShowStyleBase: studio.supportedShowStyleBase.map((id) => unprotectString(id)),
	}
}

export function studioSettingsFrom(apiStudioSettings: APIStudioSettings): IStudioSettings {
	return {
		frameRate: apiStudioSettings.frameRate,
		mediaPreviewsUrl: apiStudioSettings.mediaPreviewsUrl,
		slackEvaluationUrls: apiStudioSettings.slackEvaluationUrls?.join(','),
		supportedMediaFormats: apiStudioSettings.supportedMediaFormats?.join(','),
		supportedAudioStreams: apiStudioSettings.supportedAudioStreams?.join(','),
		enablePlayFromAnywhere: apiStudioSettings.enablePlayFromAnywhere,
		forceMultiGatewayMode: apiStudioSettings.forceMultiGatewayMode,
		multiGatewayNowSafeLatency: apiStudioSettings.multiGatewayNowSafeLatency,
		preserveUnsyncedPlayingSegmentContents: apiStudioSettings.preserveUnsyncedPlayingSegmentContents,
		allowRundownResetOnAir: apiStudioSettings.allowRundownResetOnAir,
		preserveOrphanedSegmentPositionInRundown: apiStudioSettings.preserveOrphanedSegmentPositionInRundown,
	}
}

export function APIStudioSettingsFrom(settings: IStudioSettings): APIStudioSettings {
	return {
		frameRate: settings.frameRate,
		mediaPreviewsUrl: settings.mediaPreviewsUrl,
		slackEvaluationUrls: settings.slackEvaluationUrls?.split(','),
		supportedMediaFormats: settings.supportedMediaFormats?.split(','),
		supportedAudioStreams: settings.supportedAudioStreams?.split(','),
		enablePlayFromAnywhere: settings.enablePlayFromAnywhere,
		forceMultiGatewayMode: settings.forceMultiGatewayMode,
		multiGatewayNowSafeLatency: settings.multiGatewayNowSafeLatency,
		preserveUnsyncedPlayingSegmentContents: settings.preserveUnsyncedPlayingSegmentContents,
		allowRundownResetOnAir: settings.allowRundownResetOnAir,
		preserveOrphanedSegmentPositionInRundown: settings.preserveOrphanedSegmentPositionInRundown,
	}
}

export function APIPeripheralDeviceFrom(device: PeripheralDevice): APIPeripheralDevice {
	let status: APIPeripheralDevice['status'] = 'unknown'
	switch (device.status.statusCode) {
		case StatusCode.BAD:
			status = 'bad'
			break
		case StatusCode.FATAL:
			status = 'fatal'
			break
		case StatusCode.GOOD:
			status = 'good'
			break
		case StatusCode.WARNING_MAJOR:
			status = 'warning_major'
			break
		case StatusCode.WARNING_MINOR:
			status = 'marning_minor'
			break
		case StatusCode.UNKNOWN:
			status = 'unknown'
			break
		default:
			assertNever(device.status.statusCode)
	}

	let deviceType: APIPeripheralDevice['deviceType'] = 'unknown'
	switch (device.type) {
		case PeripheralDeviceType.INEWS:
			deviceType = 'inews'
			break
		case PeripheralDeviceType.LIVE_STATUS:
			deviceType = 'live_status'
			break
		case PeripheralDeviceType.MEDIA_MANAGER:
			deviceType = 'media_manager'
			break
		case PeripheralDeviceType.MOS:
			deviceType = 'mos'
			break
		case PeripheralDeviceType.PACKAGE_MANAGER:
			deviceType = 'package_manager'
			break
		case PeripheralDeviceType.PLAYOUT:
			deviceType = 'playout'
			break
		case PeripheralDeviceType.SPREADSHEET:
			deviceType = 'spreadsheet'
			break
		case PeripheralDeviceType.INPUT:
			deviceType = 'input'
			break
		default:
			assertNever(device.type)
	}

	return {
		id: unprotectString(device._id),
		name: device.name,
		status,
		messages: device.status.messages ?? [],
		deviceType,
		connected: device.connected,
	}
}

export function APIBlueprintFrom(blueprint: Blueprint): APIBlueprint | undefined {
	if (!blueprint.blueprintType) return undefined

	return {
		id: unprotectString(blueprint._id),
		name: blueprint.name,
		blueprintType: blueprint.blueprintType,
		blueprintVersion: blueprint.blueprintVersion,
	}
}

export function APIOutputLayerFrom(outputLayer: IOutputLayer): APIOutputLayer {
	return {
		id: outputLayer._id,
		name: outputLayer.name,
		rank: outputLayer._rank,
		isPgm: outputLayer.isPGM,
	}
}
