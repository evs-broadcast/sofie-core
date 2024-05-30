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
	PeripheralDevice,
	PeripheralDeviceType,
	PeripheralDeviceCategory,
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

	const peripheralDevices = (await context.directCollections.PeripheralDevices.findFetch(
		{
			subType: PERIPHERAL_SUBTYPE_PROCESS,
			studioId: context.studioId,
		},
		{
			projection: { _id: 1, type: 1, category: 1 },
		}
	)) as Array<Pick<PeripheralDevice, '_id' | 'type' | 'category'>>
	const playoutIds = peripheralDevices.filter((p) => p.type === PeripheralDeviceType.PLAYOUT).map((p) => p._id)
	const ingestPeripheralDevices = peripheralDevices
		.filter((p) => p.category === PeripheralDeviceCategory.INGEST)
		.map((p) => ({ id: p._id, type: p.type }))
	const inputIds = peripheralDevices.filter((p) => p.type === PeripheralDeviceType.INPUT).map((p) => p._id)

	// set the peripheralDeviceId if there is exactly one parent device in the studio
	const playoutDevices = Object.fromEntries(
		Object.entries<TSR.DeviceOptionsAny>(result.playoutDevices ?? {}).map((dev) => [
			dev[0],
			literal<Complete<StudioPlayoutDevice>>({
				peripheralDeviceId: playoutIds.length === 1 ? playoutIds[0] : undefined,
				options: dev[1],
			}),
		])
	)

	const spreadsheetGateways = ingestPeripheralDevices.filter((device) => device.type === 'spreadsheet')
	const spreadsheetGatewayId = spreadsheetGateways.length === 1 ? spreadsheetGateways[0].id : undefined
	const mosGateways = ingestPeripheralDevices.filter((device) => device.type === 'mos')
	const mosGatewayId = mosGateways.length === 1 ? mosGateways[0].id : undefined

	const ingestDevices = Object.fromEntries(
		Object.entries<unknown>(result.ingestDevices ?? {}).map((dev) => {
			const { ingestDeviceType, ...payload } = dev[1] as any
			return [
				dev[0],
				literal<Complete<StudioIngestDevice>>({
					peripheralDeviceId: ingestDeviceType === 'spreadsheet' ? spreadsheetGatewayId : mosGatewayId,
					options: payload,
				}),
			]
		})
	)
	const inputDevices = Object.fromEntries(
		Object.entries<unknown>(result.inputDevices ?? {}).map((dev) => [
			dev[0],
			literal<Complete<StudioInputDevice>>({
				peripheralDeviceId: inputIds.length === 1 ? inputIds[0] : undefined,
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
