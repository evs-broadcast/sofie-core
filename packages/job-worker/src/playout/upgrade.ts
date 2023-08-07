import { BlueprintMapping, BlueprintMappings, TSR } from '@sofie-automation/blueprints-integration'
import {
	MappingsExt,
	StudioIngestDevice,
	StudioInputDevice,
	StudioPlayoutDevice,
} from '@sofie-automation/corelib/dist/dataModel/Studio'
import { Complete, clone, literal } from '@sofie-automation/corelib/dist/lib'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { wrapTranslatableMessageFromBlueprints } from '@sofie-automation/corelib/dist/TranslatableMessage'
import { BlueprintValidateConfigForStudioResult } from '@sofie-automation/corelib/dist/worker/studio'
import { compileCoreConfigValues } from '../blueprints/config'
import { CommonContext } from '../blueprints/context'
import { JobContext } from '../jobs'
import {
	PeripheralDeviceType,
	PERIPHERAL_SUBTYPE_PROCESS,
} from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'

/**
 * Run the Blueprint applyConfig for the studio
 */
export async function handleBlueprintUpgradeForStudio(context: JobContext, _data: unknown): Promise<void> {
	const blueprint = context.studioBlueprint
	if (typeof blueprint.blueprint.applyConfig !== 'function')
		throw new Error('Blueprint does not support this config flow')
	if (!blueprint.blueprintDoc || !blueprint.blueprintDoc.blueprintHash) throw new Error('Blueprint is not valid')
	if (!context.studio.blueprintConfigPresetId) throw new Error('Studio is missing config preset')

	const blueprintContext = new CommonContext({
		name: 'applyConfig',
		identifier: `studio:${context.studioId},blueprint:${blueprint.blueprintId}`,
	})
	const rawBlueprintConfig = applyAndValidateOverrides(context.studio.blueprintConfigWithOverrides).obj

	const result = blueprint.blueprint.applyConfig(
		blueprintContext,
		clone(rawBlueprintConfig),
		compileCoreConfigValues(context.studio.settings)
	)

	const peripheralPlayoutDevices = await context.directCollections.PeripheralDevices.findFetch(
		{
			type: PeripheralDeviceType.PLAYOUT,
			subType: PERIPHERAL_SUBTYPE_PROCESS,
			studioId: context.studioId,
		},
		{
			sort: {
				created: 1,
			},
		}
	)

	// set the peripherDeviceId if there is exactly one playout device in the studio
	const playoutDevices = Object.fromEntries(
		Object.entries<TSR.DeviceOptionsAny>(result.playoutDevices ?? {}).map((dev) => [
			dev[0],
			literal<Complete<StudioPlayoutDevice>>({
				peripheralDeviceId: peripheralPlayoutDevices.length === 1 ? peripheralPlayoutDevices[0]._id : undefined,
				options: dev[1],
			}),
		])
	)
	const ingestDevices = Object.fromEntries(
		Object.entries<unknown>(result.ingestDevices ?? {}).map((dev) => [
			dev[0],
			literal<Complete<StudioIngestDevice>>({
				peripheralDeviceId: undefined,
				options: dev[1],
			}),
		])
	)
	const inputDevices = Object.fromEntries(
		Object.entries<unknown>(result.inputDevices ?? {}).map((dev) => [
			dev[0],
			literal<Complete<StudioInputDevice>>({
				peripheralDeviceId: undefined,
				options: dev[1],
			}),
		])
	)

	await context.directCollections.Studios.update(
		context.studioId,
		{
			$set: {
				'mappingsWithOverrides.defaults': translateMappings(result.mappings),
				'peripheralDeviceSettings.playoutDevices.defaults': playoutDevices,
				'peripheralDeviceSettings.ingestDevices.defaults': ingestDevices,
				'peripheralDeviceSettings.inputDevices.defaults': inputDevices,
				lastBlueprintConfig: {
					blueprintHash: blueprint.blueprintDoc.blueprintHash,
					blueprintId: blueprint.blueprintId,
					blueprintConfigPresetId: context.studio.blueprintConfigPresetId,
					config: rawBlueprintConfig,
				},
			},
		},
		null // Single operation
	)
}

function translateMappings(rawMappings: BlueprintMappings): MappingsExt {
	const mappings: MappingsExt = {}

	for (const [id, mapping] of Object.entries<BlueprintMapping>(rawMappings)) {
		mappings[id] = {
			...mapping,
			deviceId: protectString(mapping.deviceId),
		}
	}

	return mappings
}

/**
 * Validate the blueprintConfig for the Studio, with the Blueprint validateConfig
 */
export async function handleBlueprintValidateConfigForStudio(
	context: JobContext,
	_data: unknown
): Promise<BlueprintValidateConfigForStudioResult> {
	const blueprint = context.studioBlueprint
	if (typeof blueprint.blueprint.validateConfig !== 'function')
		throw new Error('Blueprint does not support this config flow')
	if (!blueprint.blueprintDoc || !blueprint.blueprintDoc.blueprintHash) throw new Error('Blueprint is not valid')
	if (!context.studio.blueprintConfigPresetId) throw new Error('Studio is missing config preset')

	const blueprintContext = new CommonContext({
		name: 'validateConfig',
		identifier: `studio:${context.studioId},blueprint:${blueprint.blueprintId}`,
	})
	const rawBlueprintConfig = applyAndValidateOverrides(context.studio.blueprintConfigWithOverrides).obj

	// TODO - why is this clone necessary?
	const messages = clone(blueprint.blueprint.validateConfig(blueprintContext, rawBlueprintConfig))

	return {
		messages: messages.map((msg) => ({
			level: msg.level,
			message: wrapTranslatableMessageFromBlueprints(msg.message, [blueprint.blueprintId]),
		})),
	}
}
