import {
	BlueprintManifestType,
	IBlueprintConfig,
	IConfigMessage,
	IOutputLayer,
	ISourceLayer,
	ShowStyleBlueprintManifest,
	SourceLayerType,
	StatusCode,
	StudioBlueprintManifest,
} from '@sofie-automation/blueprints-integration'
import { PeripheralDevice, PeripheralDeviceType } from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { Blueprint } from '@sofie-automation/corelib/dist/dataModel/Blueprint'
import {
	BlueprintId,
	ShowStyleBaseId,
	ShowStyleVariantId,
	StudioId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBStudio, IStudioSettings } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { assertNever, getRandomId, literal } from '@sofie-automation/corelib/dist/lib'
import { protectString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import {
	applyAndValidateOverrides,
	ObjectOverrideSetOp,
	wrapDefaultObject,
	updateOverrides,
	convertObjectIntoOverrides,
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
import { Blueprints, ShowStyleBases, Studios } from '../../../collections'
import { Meteor } from 'meteor/meteor'
import { evalBlueprint } from '../../blueprints/cache'
import { CommonContext } from '../../../migration/upgrades/context'

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

export async function APIShowStyleBaseFrom(showStyleBase: ShowStyleBase): Promise<APIShowStyleBase> {
	const blueprintConfig = await APIShowStyleBlueprintConfigFrom(showStyleBase)
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
		config: blueprintConfig,
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
		blueprintConfigPresetId: apiShowStyleVariant.blueprintConfigPresetId,
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
		blueprintConfigPresetId: showStyleVariant.blueprintConfigPresetId,
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
		? updateOverrides(studio.blueprintConfigWithOverrides, await StudioBlueprintConfigFromAPI(apiStudio))
		: convertObjectIntoOverrides(await StudioBlueprintConfigFromAPI(apiStudio))

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
			playoutDevices: wrapDefaultObject({}),
			ingestDevices: wrapDefaultObject({}),
			inputDevices: wrapDefaultObject({}),
		},
		lastBlueprintConfig: undefined,
	}
}

export async function APIStudioFrom(studio: Studio): Promise<APIStudio> {
	const studioSettings = APIStudioSettingsFrom(studio.settings)
	const blueprintConfig = await APIStudioBlueprintConfigFrom(studio)
	return {
		name: studio.name,
		blueprintId: unprotectString(studio.blueprintId),
		blueprintConfigPresetId: studio.blueprintConfigPresetId,
		config: blueprintConfig,
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

async function getBlueprint(
	blueprintId: BlueprintId | undefined,
	blueprintType: BlueprintManifestType
): Promise<Blueprint> {
	const blueprint = blueprintId
		? await Blueprints.findOneAsync({
				_id: blueprintId,
				blueprintType,
		  })
		: undefined
	if (!blueprint) throw new Meteor.Error(404, `Blueprint "${blueprintId}" not found!`)

	if (!blueprint.blueprintHash) throw new Meteor.Error(500, 'Blueprint is not valid')

	return blueprint
}

export async function validateAPIBlueprintConfigForShowStyleBase(
	apiShowStyleBase: APIShowStyleBase
): Promise<Array<IConfigMessage>> {
	if (!apiShowStyleBase.blueprintConfigPresetId) throw new Meteor.Error(500, 'ShowStyleBase is missing config preset')
	const blueprint = await getBlueprint(protectString(apiShowStyleBase.blueprintId), BlueprintManifestType.SHOWSTYLE)
	const blueprintManifest = evalBlueprint(blueprint) as ShowStyleBlueprintManifest

	if (typeof blueprintManifest.validateConfigFromAPI !== 'function')
		throw new Meteor.Error(500, 'Blueprint does not support this config flow')

	const blueprintContext = new CommonContext(
		'validateAPIBlueprintConfig',
		`showStyleBase:${apiShowStyleBase.name},blueprint:${blueprint._id}`
	)

	return blueprintManifest.validateConfigFromAPI(blueprintContext, apiShowStyleBase.config)
}

export async function ShowStyleBaseBlueprintConfigFromAPI(
	apiShowStyleBase: APIShowStyleBase
): Promise<IBlueprintConfig> {
	if (!apiShowStyleBase.blueprintConfigPresetId) throw new Meteor.Error(500, 'ShowStyleBase is missing config preset')
	const blueprint = await getBlueprint(protectString(apiShowStyleBase.blueprintId), BlueprintManifestType.SHOWSTYLE)
	const blueprintManifest = evalBlueprint(blueprint) as ShowStyleBlueprintManifest

	if (typeof blueprintManifest.blueprintConfigFromAPI !== 'function')
		throw new Meteor.Error(500, 'Blueprint does not support this config flow')

	const blueprintContext = new CommonContext(
		'BlueprintConfigFromAPI',
		`showStyleBase:${apiShowStyleBase.name},blueprint:${blueprint._id}`
	)

	return blueprintManifest.blueprintConfigFromAPI(blueprintContext, apiShowStyleBase.config)
}

export async function APIShowStyleBlueprintConfigFrom(showStyleBase: ShowStyleBase): Promise<object> {
	if (!showStyleBase.blueprintConfigPresetId) throw new Meteor.Error(500, 'ShowStyleBase is missing config preset')
	const blueprint = await getBlueprint(showStyleBase.blueprintId, BlueprintManifestType.SHOWSTYLE)
	const blueprintManifest = evalBlueprint(blueprint) as ShowStyleBlueprintManifest

	if (typeof blueprintManifest.blueprintConfigToAPI !== 'function')
		throw new Meteor.Error(500, 'Blueprint does not support this config flow')

	const blueprintContext = new CommonContext(
		'APIShowStyleBlueprintConfigFrom',
		`showStyleBase:${showStyleBase._id},blueprint:${blueprint._id}`
	)

	return blueprintManifest.blueprintConfigToAPI(
		blueprintContext,
		applyAndValidateOverrides(showStyleBase.blueprintConfigWithOverrides).obj
	)
}

export async function validateAPIBlueprintConfigForStudio(apiStudio: APIStudio): Promise<Array<IConfigMessage>> {
	if (!apiStudio.blueprintConfigPresetId) throw new Meteor.Error(500, 'Studio is missing config preset')
	const blueprint = await getBlueprint(protectString(apiStudio.blueprintId), BlueprintManifestType.STUDIO)
	const blueprintManifest = evalBlueprint(blueprint) as StudioBlueprintManifest

	if (typeof blueprintManifest.validateConfigFromAPI !== 'function')
		throw new Meteor.Error(500, 'Blueprint does not support this config flow')

	const blueprintContext = new CommonContext(
		'validateAPIBlueprintConfig',
		`studio:${apiStudio.name},blueprint:${blueprint._id}`
	)

	return blueprintManifest.validateConfigFromAPI(blueprintContext, apiStudio.config)
}

export async function StudioBlueprintConfigFromAPI(apiStudio: APIStudio): Promise<IBlueprintConfig> {
	if (!apiStudio.blueprintConfigPresetId) throw new Meteor.Error(500, 'Studio is missing config preset')
	const blueprint = await getBlueprint(protectString(apiStudio.blueprintId), BlueprintManifestType.STUDIO)
	const blueprintManifest = evalBlueprint(blueprint) as StudioBlueprintManifest

	if (typeof blueprintManifest.blueprintConfigFromAPI !== 'function')
		throw new Meteor.Error(500, 'Blueprint does not support this config flow')

	const blueprintContext = new CommonContext(
		'BlueprintConfigFromAPI',
		`studio:${apiStudio.name},blueprint:${blueprint._id}`
	)

	return blueprintManifest.blueprintConfigFromAPI(blueprintContext, apiStudio.config)
}

export async function APIStudioBlueprintConfigFrom(studio: Studio): Promise<object> {
	if (!studio.blueprintConfigPresetId) throw new Meteor.Error(500, 'Studio is missing config preset')
	const blueprint = await getBlueprint(studio.blueprintId, BlueprintManifestType.STUDIO)
	const blueprintManifest = evalBlueprint(blueprint) as StudioBlueprintManifest

	if (typeof blueprintManifest.blueprintConfigToAPI !== 'function')
		throw new Meteor.Error(500, 'Blueprint does not support this config flow')

	const blueprintContext = new CommonContext(
		'APIStudioBlueprintConfigFrom',
		`studio:${studio.name},blueprint:${blueprint._id}`
	)

	return blueprintManifest.blueprintConfigToAPI(
		blueprintContext,
		applyAndValidateOverrides(studio.blueprintConfigWithOverrides).obj
	)
}
