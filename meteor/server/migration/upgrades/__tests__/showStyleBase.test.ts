import '../../../../__mocks__/_extendJest'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { runUpgradeForShowStyleBase, validateConfigForShowStyleBase } from '../showStyleBase'
import { setupMockShowStyleBase, setupMockShowStyleBlueprint } from '../../../../__mocks__/helpers/database'
import { testInFiber } from '../../../../__mocks__/helpers/jest'
import {
	BlueprintManifestType,
	BlueprintResultApplyShowStyleConfig,
	NoteSeverity,
	PlayoutActions,
	ShowStyleBlueprintManifest,
	SourceLayerType,
	TriggerType,
} from '@sofie-automation/blueprints-integration'
import { clone, generateTranslation, getRandomString, normalizeArray, omit } from '../../../../lib/lib'
import { literal } from '@sofie-automation/shared-lib/dist/lib/lib'
import { BlueprintValidateConfigForStudioResult } from '@sofie-automation/corelib/dist/worker/studio'
import { wrapTranslatableMessageFromBlueprints } from '@sofie-automation/corelib/dist/TranslatableMessage'

import * as blueprintCache from '../../../api/blueprints/cache'
import { ShowStyleBase } from '../../../../lib/collections/ShowStyleBases'
import { ShowStyleBases, TriggeredActions } from '../../../collections'
import { JSONBlobStringify } from '@sofie-automation/shared-lib/dist/lib/JSONBlob'

describe('ShowStyleBase upgrades', () => {
	afterEach(() => {
		jest.restoreAllMocks()
	})

	function setupBlueprintMockResult(snippet: Partial<ShowStyleBlueprintManifest>) {
		jest.spyOn(blueprintCache, 'evalBlueprint').mockReturnValue(
			literal<ShowStyleBlueprintManifest>({
				blueprintType: BlueprintManifestType.SHOWSTYLE,
				blueprintVersion: '0.0.0',
				integrationVersion: '0.0.0',
				TSRVersion: '0.0.0',

				configPresets: {
					main: {
						name: 'Main',
						config: {},

						variants: {
							main: {
								name: 'Default',
								config: {},
							},
						},
					},
				},

				showStyleConfigSchema: JSONBlobStringify({}),
				showStyleMigrations: [],
				getShowStyleVariantId: (): string | null => {
					return null
				},
				getRundown: () => {
					throw new Error('Not implemented')
				},
				getSegment: () => {
					throw new Error('Not implemented')
				},
				...snippet,
			})
		)
	}

	describe('validateConfigForShowStyleBase', () => {
		testInFiber('Missing id', async () => {
			await expect(validateConfigForShowStyleBase(protectString('fakeId'))).rejects.toThrowMeteor(
				404,
				`ShowStyleBase "fakeId" not found!`
			)
		})

		testInFiber('Missing config preset', async () => {
			const blueprint = await setupMockShowStyleBlueprint(protectString(''))
			const showStyleBase = setupMockShowStyleBase(blueprint._id)

			await expect(validateConfigForShowStyleBase(showStyleBase._id)).rejects.toThrowMeteor(
				500,
				`ShowStyleBase is missing config preset`
			)
		})

		testInFiber('Missing blueprint', async () => {
			const showStyleBase = setupMockShowStyleBase(protectString('fakeId'), {
				blueprintConfigPresetId: 'fake-preset',
			})

			await expect(validateConfigForShowStyleBase(showStyleBase._id)).rejects.toThrowMeteor(
				404,
				`Blueprint "fakeId" not found!`
			)
		})

		testInFiber('Unsupported blueprint', async () => {
			const blueprint = await setupMockShowStyleBlueprint(protectString(''))
			const showStyleBase = setupMockShowStyleBase(blueprint._id, {
				blueprintConfigPresetId: 'fake-preset',
			})

			await expect(validateConfigForShowStyleBase(showStyleBase._id)).rejects.toThrowMeteor(
				500,
				`Blueprint does not support this config flow`
			)
		})

		testInFiber('Success: no messages', async () => {
			const blueprint = await setupMockShowStyleBlueprint(protectString(''))
			const showStyleBase = setupMockShowStyleBase(blueprint._id, {
				blueprintConfigPresetId: 'fake-preset',
			})

			setupBlueprintMockResult({
				validateConfig: () => {
					return []
				},
			})

			const result = await validateConfigForShowStyleBase(showStyleBase._id)
			expect(result).toBeTruthy()
			expect(result.messages).toHaveLength(0)
		})

		testInFiber('Success: some messages', async () => {
			const blueprint = await setupMockShowStyleBlueprint(protectString(''))
			const showStyleBase = setupMockShowStyleBase(blueprint._id, {
				blueprintConfigPresetId: 'fake-preset',
			})

			setupBlueprintMockResult({
				validateConfig: () => {
					return [
						{
							level: NoteSeverity.INFO,
							message: generateTranslation('Test Info message'),
						},
						{
							level: NoteSeverity.ERROR,
							message: generateTranslation('Test ERROR message'),
						},
					]
				},
			})

			const result = await validateConfigForShowStyleBase(showStyleBase._id)
			expect(result).toBeTruthy()
			expect(result.messages).toHaveLength(2)
			expect(result.messages).toEqual(
				literal<BlueprintValidateConfigForStudioResult['messages']>([
					{
						level: NoteSeverity.INFO,
						message: wrapTranslatableMessageFromBlueprints(generateTranslation('Test Info message'), [
							blueprint._id,
						]),
					},
					{
						level: NoteSeverity.ERROR,
						message: wrapTranslatableMessageFromBlueprints(generateTranslation('Test ERROR message'), [
							blueprint._id,
						]),
					},
				])
			)
		})
	})

	describe('runUpgradeForShowStyleBase', () => {
		testInFiber('Missing id', async () => {
			await expect(runUpgradeForShowStyleBase(protectString('fakeId'))).rejects.toThrowMeteor(
				404,
				`ShowStyleBase "fakeId" not found!`
			)
		})

		testInFiber('Missing config preset', async () => {
			const blueprint = await setupMockShowStyleBlueprint(protectString(''))
			const showStyleBase = setupMockShowStyleBase(blueprint._id)

			await expect(runUpgradeForShowStyleBase(showStyleBase._id)).rejects.toThrowMeteor(
				500,
				`ShowStyleBase is missing config preset`
			)
		})

		testInFiber('Missing blueprint', async () => {
			const showStyleBase = setupMockShowStyleBase(protectString('fakeId'), {
				blueprintConfigPresetId: 'fake-preset',
			})

			await expect(runUpgradeForShowStyleBase(showStyleBase._id)).rejects.toThrowMeteor(
				404,
				`Blueprint "fakeId" not found!`
			)
		})

		testInFiber('Unsupported blueprint', async () => {
			const blueprint = await setupMockShowStyleBlueprint(protectString(''))
			const showStyleBase = setupMockShowStyleBase(blueprint._id, {
				blueprintConfigPresetId: 'fake-preset',
			})

			await expect(runUpgradeForShowStyleBase(showStyleBase._id)).rejects.toThrowMeteor(
				500,
				`Blueprint does not support this config flow`
			)
		})

		testInFiber('Success', async () => {
			const blueprint = await setupMockShowStyleBlueprint(protectString(''))
			const showStyleBase = clone(
				setupMockShowStyleBase(blueprint._id, {
					blueprintConfigPresetId: 'fake-preset',
				})
			)

			const targetResult: BlueprintResultApplyShowStyleConfig = {
				sourceLayers: [
					{
						_id: getRandomString(),
						_rank: 12,
						name: getRandomString(),
						type: SourceLayerType.CAMERA,
					},
					{
						_id: getRandomString(),
						_rank: 55,
						name: getRandomString(),
						type: SourceLayerType.UNKNOWN,
					},
				],
				outputLayers: [
					{
						_id: getRandomString(),
						_rank: 55,
						name: getRandomString(),
						isPGM: true,
					},
					{
						_id: getRandomString(),
						_rank: 9999,
						name: getRandomString(),
						isPGM: false,
					},
				],
				triggeredActions: [
					{
						_id: getRandomString(),
						_rank: 999,
						actions: {
							one: {
								action: PlayoutActions.take,
								filterChain: [],
							},
						},
						triggers: {
							two: {
								type: TriggerType.hotkey,
								keys: getRandomString(),
							},
						},
					},
					{
						_id: getRandomString(),
						_rank: 9000,
						actions: {
							one: {
								action: PlayoutActions.take,
								filterChain: [],
							},
						},
						triggers: {
							two: {
								type: TriggerType.hotkey,
								keys: getRandomString(),
							},
						},
					},
				],
			}

			setupBlueprintMockResult({
				applyConfig: (_context, config) => {
					expect(config).toBeTruthy()

					return clone(targetResult)
				},
			})

			await runUpgradeForShowStyleBase(showStyleBase._id)

			// Check the result matches as expected
			const showStyleBase2 = ShowStyleBases.findOne(showStyleBase._id) as ShowStyleBase
			expect(showStyleBase2).toBeTruthy()

			expect(showStyleBase2.sourceLayersWithOverrides.defaults).not.toEqual(
				showStyleBase.sourceLayersWithOverrides.defaults
			)
			expect(showStyleBase2.outputLayersWithOverrides.defaults).not.toEqual(
				showStyleBase.outputLayersWithOverrides.defaults
			)

			expect(showStyleBase2.sourceLayersWithOverrides.defaults).toEqual(
				normalizeArray(targetResult.sourceLayers, '_id')
			)
			expect(showStyleBase2.outputLayersWithOverrides.defaults).toEqual(
				normalizeArray(targetResult.outputLayers, '_id')
			)

			const triggeredActions = TriggeredActions.find({ showStyleBaseId: showStyleBase._id }).fetch()
			expect(
				triggeredActions.map((triggeredAction) => ({
					_rank: triggeredAction._rank,
					actions: triggeredAction.actionsWithOverrides.defaults,
					triggers: triggeredAction.triggersWithOverrides.defaults,
				}))
			).toEqual(targetResult.triggeredActions.map((a) => omit(a, '_id')))
		})
	})
})
