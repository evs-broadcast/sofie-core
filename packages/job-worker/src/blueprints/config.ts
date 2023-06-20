import { ShowStyleVariantId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ReadonlyDeep } from 'type-fest'
import {
	BlueprintConfigCoreConfig,
	ConfigItemValue,
	ShowStyleBlueprintManifest,
	StudioBlueprintManifest,
} from '@sofie-automation/blueprints-integration'
import { getSofieHostUrl, objectPathGet, stringifyError, clone } from '@sofie-automation/corelib/dist/lib'
import _ = require('underscore')
import { logger } from '../logging'
import { CommonContext } from './context'
import { DBStudio, IStudioSettings } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { JobContext, ProcessedShowStyleCompound, StudioCacheContext } from '../jobs'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'

/**
 * This whole ConfigRef logic will need revisiting for a multi-studio context, to ensure that there are strict boundaries across who can give to access to what.
 * Especially relevant for multi-user.
 */
// export namespace ConfigRef {
export function getStudioConfigRef(studioId: StudioId, configKey: string): string {
	return '${studio.' + studioId + '.' + configKey + '}'
}
export function getShowStyleConfigRef(showStyleVariantId: ShowStyleVariantId, configKey: string): string {
	return '${showStyle.' + showStyleVariantId + '.' + configKey + '}'
}

/**
 * Parse a string containing BlueprintConfigRefs (`${studio.studio0.myConfigField}`) to replace the refs with the current values
 * @param context The studio context this is being run in
 * @param stringWithReferences String to resolve
 * @param modifier Modify the value before performing the replacement
 * @param bailOnError If true, errors will be thrown. If false, replacements will be skipped instead of throwing an error
 * @returns string with BlueprintConfigRefs replaced with values
 */
export async function retrieveBlueprintConfigRefs(
	context: StudioCacheContext,
	stringWithReferences: string,
	modifier?: (str: string) => string,
	bailOnError?: boolean
): Promise<string> {
	if (!stringWithReferences) return stringWithReferences

	const refs = stringWithReferences.match(/\$\{[^}]+\}/g) || []
	for (const ref of refs) {
		if (ref) {
			let value = (await retrieveBlueprintConfigRef(context, ref, bailOnError)) + ''
			if (value) {
				if (modifier) value = modifier(value)
				stringWithReferences = stringWithReferences.replace(ref, value)
			}
		}
	}
	return stringWithReferences
}
async function retrieveBlueprintConfigRef(
	context: StudioCacheContext,
	reference: string,
	bailOnError?: boolean
): Promise<ConfigItemValue | undefined> {
	if (!reference) return undefined

	const m = reference.match(/\$\{([^.}]+)\.([^.}]+)\.([^}]+)\}/)
	if (m) {
		if (m[1] === 'studio' && _.isString(m[2]) && _.isString(m[3])) {
			const studioId: StudioId = protectString(m[2])
			if (studioId === context.studioId) {
				const configId = m[3]
				const studioConfig = context.getStudioBlueprintConfig()
				return objectPathGet(studioConfig, configId)
			} else if (bailOnError) throw new Error(`Ref "${reference}": Studio "${studioId}" not valid`)
		} else if (m[1] === 'showStyle' && _.isString(m[2]) && _.isString(m[3])) {
			const showStyleVariantId = protectString<ShowStyleVariantId>(m[2])
			const configId = m[3]

			const showStyleCompound = await context.getShowStyleCompound(showStyleVariantId).catch(() => undefined)
			if (showStyleCompound) {
				const showStyleConfig = context.getShowStyleBlueprintConfig(showStyleCompound)
				return objectPathGet(showStyleConfig, configId)
			} else if (bailOnError) {
				throw new Error(`Ref "${reference}": Showstyle variant "${showStyleVariantId}" not found`)
			}
		}
	}
	return undefined
}

export interface ProcessedShowStyleConfig {
	_showStyleConfig: never
}

export interface ProcessedStudioConfig {
	_studioConfig: never
}

/**
 * Get the `BlueprintConfigCoreConfig`
 * This is a set of values provided to the blueprints about the environment, such as the url to access sofie ui
 */
export function compileCoreConfigValues(studioSettings: ReadonlyDeep<IStudioSettings>): BlueprintConfigCoreConfig {
	return {
		hostUrl: getSofieHostUrl(),
		frameRate: studioSettings.frameRate,
	}
}

/**
 * Compile the complete Studio config
 * Resolves any overrides defined by the user, and run the result through the `preprocessConfig` blueprint method
 */
export function preprocessStudioConfig(
	studio: ReadonlyDeep<DBStudio>,
	blueprint: ReadonlyDeep<StudioBlueprintManifest>
): ProcessedStudioConfig {
	let res: any = applyAndValidateOverrides(studio.blueprintConfigWithOverrides).obj

	try {
		if (blueprint.preprocessConfig) {
			const context = new CommonContext({
				name: `preprocessStudioConfig`,
				identifier: `studioId=${studio._id}`,
			})
			res = blueprint.preprocessConfig(context, res, compileCoreConfigValues(studio.settings))
		}
	} catch (err) {
		logger.error(`Error in studioBlueprint.preprocessConfig: ${stringifyError(err)}`)
	}

	return res
}

/**
 * Compile the complete ShowStyle config
 * Resolves any overrides defined by the user, and run the result through the `preprocessConfig` blueprint method
 */
export function preprocessShowStyleConfig(
	showStyle: Pick<ReadonlyDeep<ProcessedShowStyleCompound>, '_id' | 'combinedBlueprintConfig' | 'showStyleVariantId'>,
	blueprint: ReadonlyDeep<ShowStyleBlueprintManifest>,
	studioSettings: ReadonlyDeep<IStudioSettings>
): ProcessedShowStyleConfig {
	let res: any = showStyle.combinedBlueprintConfig

	try {
		if (blueprint.preprocessConfig) {
			const context = new CommonContext({
				name: `preprocessShowStyleConfig`,
				identifier: `showStyleBaseId=${showStyle._id},showStyleVariantId=${showStyle.showStyleVariantId}`,
			})
			res = blueprint.preprocessConfig(context, res, compileCoreConfigValues(studioSettings))
		}
	} catch (err) {
		logger.error(`Error in showStyleBlueprint.preprocessConfig: ${stringifyError(err)}`)
	}

	return res
}

export async function handleBlueprintConfigToAPI(context: JobContext, _data: unknown): Promise<object> {
	console.log('handleBlueprintConfigToAPI')

	const blueprint = context.studioBlueprint
	if (typeof blueprint.blueprint.blueprintConfigToAPI !== 'function')
		throw new Error('Blueprint does not support this config flow')
	if (!blueprint.blueprintDoc || !blueprint.blueprintDoc.blueprintHash) throw new Error('Blueprint is not valid')
	if (!context.studio.blueprintConfigPresetId) throw new Error('Studio is missing config preset')

	const blueprintContext = new CommonContext({
		name: 'configToAPI',
		identifier: `studio:${context.studioId},blueprint:${blueprint.blueprintId}`,
	})
	const rawBlueprintConfig = applyAndValidateOverrides(context.studio.blueprintConfigWithOverrides).obj

	// TODO - why is this clone necessary?
	return clone(blueprint.blueprint.blueprintConfigToAPI(blueprintContext, rawBlueprintConfig))
}
