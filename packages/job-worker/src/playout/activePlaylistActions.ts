import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import { getActiveRundownPlaylistsInStudioFromDb } from '../studio/lib'
import { JobContext } from '../jobs'
import { logger } from '../logging'
import { PlayoutModel } from './model/PlayoutModel'
import { resetRundownPlaylist } from './lib'
import { selectNextPart } from './selectNextPart'
import { setNextPart } from './setNext'
import { updateStudioTimeline, updateTimeline } from './timeline/generate'
import { getCurrentTime } from '../lib'
import { cleanTimelineDatastore } from './datastore'
import { RundownActivationContext } from '../blueprints/context/RundownActivationContext'
import { ReadonlyDeep } from 'type-fest'

export async function activateRundownPlaylist(
	context: JobContext,
	playoutModel: PlayoutModel,
	rehearsal: boolean
): Promise<void> {
	logger.info('Activating rundown ' + playoutModel.Playlist._id + (rehearsal ? ' (Rehearsal)' : ''))

	rehearsal = !!rehearsal
	const wasActive = !!playoutModel.Playlist.activationId

	const anyOtherActiveRundowns = await getActiveRundownPlaylistsInStudioFromDb(
		context,
		context.studio._id,
		playoutModel.Playlist._id
	)
	if (anyOtherActiveRundowns.length) {
		// logger.warn('Only one rundown can be active at the same time. Active rundowns: ' + _.map(anyOtherActiveRundowns, rundown => rundown._id))
		const otherActiveIds = anyOtherActiveRundowns.map((playlist) => playlist._id)
		throw new Error(
			'Only one rundown can be active at the same time. Active rundown playlists: ' +
				JSON.stringify(otherActiveIds)
		)
	}

	if (!playoutModel.Playlist.activationId) {
		// Reset the playlist if it wasnt already active
		await resetRundownPlaylist(context, playoutModel)
	}

	const newActivationId = playoutModel.activatePlaylist(rehearsal)

	let rundown: ReadonlyDeep<DBRundown> | undefined

	const currentPartInstance = playoutModel.CurrentPartInstance
	if (!currentPartInstance || currentPartInstance.PartInstance.reset) {
		playoutModel.clearSelectedPartInstances()

		// If we are not playing anything, then regenerate the next part
		const firstPart = selectNextPart(
			context,
			playoutModel.Playlist,
			null,
			null,
			playoutModel.getAllOrderedSegments(),
			playoutModel.getAllOrderedParts()
		)
		await setNextPart(context, playoutModel, firstPart, false)

		if (firstPart) {
			rundown = playoutModel.getRundown(firstPart.part.rundownId)?.Rundown
		}
	} else {
		// Otherwise preserve the active partInstances
		for (const partInstance of playoutModel.SelectedPartInstances) {
			partInstance.setPlaylistActivationId(newActivationId)
		}

		const nextPartInstance = playoutModel.NextPartInstance
		if (nextPartInstance) {
			rundown = playoutModel.getRundown(nextPartInstance.PartInstance.rundownId)?.Rundown
			if (!rundown) throw new Error(`Could not find rundown "${nextPartInstance.PartInstance.rundownId}"`)
		}
	}

	await updateTimeline(context, playoutModel)

	playoutModel.deferBeforeSave(async () => {
		if (!rundown) return // if the proper rundown hasn't been found, there's little point doing anything else
		const showStyle = await context.getShowStyleCompound(rundown.showStyleVariantId, rundown.showStyleBaseId)
		const blueprint = await context.getShowStyleBlueprint(showStyle._id)

		try {
			if (blueprint.blueprint.onRundownActivate) {
				const blueprintContext = new RundownActivationContext(context, playoutModel, showStyle, rundown)

				await blueprint.blueprint.onRundownActivate(blueprintContext, wasActive)
			}
		} catch (err) {
			logger.error(`Error in showStyleBlueprint.onRundownActivate: ${stringifyError(err)}`)
		}
	})
}
export async function deactivateRundownPlaylist(context: JobContext, playoutModel: PlayoutModel): Promise<void> {
	const rundown = await deactivateRundownPlaylistInner(context, playoutModel)

	await updateStudioTimeline(context, playoutModel)

	await cleanTimelineDatastore(context, playoutModel)

	playoutModel.deferBeforeSave(async () => {
		if (rundown) {
			const showStyle = await context.getShowStyleCompound(rundown.showStyleVariantId, rundown.showStyleBaseId)
			const blueprint = await context.getShowStyleBlueprint(showStyle._id)

			try {
				if (blueprint.blueprint.onRundownDeActivate) {
					const blueprintContext = new RundownActivationContext(context, playoutModel, showStyle, rundown)
					await blueprint.blueprint.onRundownDeActivate(blueprintContext)
				}
			} catch (err) {
				logger.error(`Error in showStyleBlueprint.onRundownDeActivate: ${stringifyError(err)}`)
			}
		}
	})
}
export async function deactivateRundownPlaylistInner(
	context: JobContext,
	playoutModel: PlayoutModel
): Promise<ReadonlyDeep<DBRundown> | undefined> {
	const span = context.startSpan('deactivateRundownPlaylistInner')
	logger.info(`Deactivating rundown playlist "${playoutModel.Playlist._id}"`)

	const currentPartInstance = playoutModel.CurrentPartInstance
	const nextPartInstance = playoutModel.NextPartInstance

	let rundown: ReadonlyDeep<DBRundown> | undefined
	if (currentPartInstance) {
		rundown = playoutModel.getRundown(currentPartInstance.PartInstance.rundownId)?.Rundown

		playoutModel.queueNotifyCurrentlyPlayingPartEvent(currentPartInstance.PartInstance.rundownId, null)
	} else if (nextPartInstance) {
		rundown = playoutModel.getRundown(nextPartInstance.PartInstance.rundownId)?.Rundown
	}

	playoutModel.deactivatePlaylist()

	await setNextPart(context, playoutModel, null, false)

	if (currentPartInstance) {
		// Set the current PartInstance as stopped
		currentPartInstance.setPlannedStoppedPlayback(getCurrentTime())
	}

	if (span) span.end()
	return rundown
}
