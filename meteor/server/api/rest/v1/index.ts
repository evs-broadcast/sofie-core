import KoaRouter from '@koa/router'
import { interpollateTranslation, translateMessage } from '@sofie-automation/corelib/dist/TranslatableMessage'
import { UserError, UserErrorMessage } from '@sofie-automation/corelib/dist/error'
import Koa from 'koa'
import bodyParser from 'koa-bodyparser'
import { Meteor } from 'meteor/meteor'
import { ClientAPI } from '../../../../lib/api/client'
import { MethodContextAPI } from '../../../../lib/api/methods'
import { logger } from '../../../logging'
import { CURRENT_SYSTEM_VERSION } from '../../../migration/currentSystemVersion'
import { Credentials } from '../../../security/lib/credentials'
import { triggerWriteAccess } from '../../../security/lib/securityVerify'
import { makeMeteorConnectionFromKoa } from '../koa'
import { registerRoutes as registerBlueprintsRoutes } from './blueprints'
import { registerRoutes as registerDevicesRoutes } from './devices'
import { registerRoutes as registerPlaylistsRoutes } from './playlists'
import { registerRoutes as registerShowStylesRoutes } from './showstyles'
import { registerRoutes as registerStudiosRoutes } from './studios'
import { registerRoutes as registerSystemRoutes } from './system'
import { registerRoutes as registerBucketsRoutes } from './buckets'
import { APIFactory, ServerAPIContext } from './types'
import { getSystemStatus } from '../../../systemStatus/systemStatus'
import { Component, ExternalStatus } from '../../../../lib/api/systemStatus'

function restAPIUserEvent(
	ctx: Koa.ParameterizedContext<
		Koa.DefaultState,
		Koa.DefaultContext & KoaRouter.RouterParamContext<Koa.DefaultState, Koa.DefaultContext>,
		unknown
	>
): string {
	return `rest_api_${ctx.method}_${ctx.URL.origin}/api/v1.0${ctx.URL.pathname}}`
}

class APIContext implements ServerAPIContext {
	public getMethodContext(connection: Meteor.Connection): MethodContextAPI {
		return {
			userId: null,
			connection,
			isSimulation: false,
			setUserId: () => {
				/* no-op */
			},
			unblock: () => {
				/* no-op */
			},
		}
	}

	public getCredentials(): Credentials {
		return { userId: null }
	}

	async index(): Promise<ClientAPI.ClientResponse<{ version: string }>> {
		triggerWriteAccess()

		return ClientAPI.responseSuccess({ version: CURRENT_SYSTEM_VERSION })
	}

	async getAllRundownPlaylists(
		_connection: Meteor.Connection,
		_event: string
	): Promise<ClientAPI.ClientResponse<Array<{ id: string; externalId: string }>>> {
		const rundownPlaylists = (await RundownPlaylists.findFetchAsync(
			{},
			{ projection: { _id: 1, externalId: 1 } }
		)) as Array<Pick<RundownPlaylist, '_id' | 'externalId'>>
		return ClientAPI.responseSuccess(
			rundownPlaylists.map((rundownPlaylist) => ({
				id: unprotectString(rundownPlaylist._id),
				externalId: rundownPlaylist.externalId,
			}))
		)
	}

	async activate(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId,
		rehearsal: boolean
	): Promise<ClientAPI.ClientResponse<void>> {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			ServerRestAPI.getMethodContext(connection),
			event,
			getCurrentTime(),
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
				check(rehearsal, Boolean)
			},
			StudioJobs.ActivateRundownPlaylist,
			{
				playlistId: rundownPlaylistId,
				rehearsal,
			}
		)
	}
	async deactivate(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId
	): Promise<ClientAPI.ClientResponse<void>> {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			ServerRestAPI.getMethodContext(connection),
			event,
			getCurrentTime(),
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
			},
			StudioJobs.DeactivateRundownPlaylist,
			{
				playlistId: rundownPlaylistId,
			}
		)
	}
	async executeAdLib(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId,
		adLibId: AdLibActionId | RundownBaselineAdLibActionId | PieceId | BucketAdLibId,
		triggerMode?: string | null,
		adLibOptions?: any
	): Promise<ClientAPI.ClientResponse<object>> {
		const baselineAdLibPiece = RundownBaselineAdLibPieces.findOneAsync(adLibId as PieceId, {
			projection: { _id: 1 },
		})
		const segmentAdLibPiece = AdLibPieces.findOneAsync(adLibId as PieceId, { projection: { _id: 1 } })
		const bucketAdLibPiece = BucketAdLibs.findOneAsync(adLibId as BucketAdLibId, { projection: { _id: 1 } })
		const [baselineAdLibDoc, segmentAdLibDoc, bucketAdLibDoc, adLibAction, baselineAdLibAction] = await Promise.all(
			[
				baselineAdLibPiece,
				segmentAdLibPiece,
				bucketAdLibPiece,
				AdLibActions.findOneAsync(adLibId as AdLibActionId, {
					projection: { _id: 1, actionId: 1, userData: 1 },
				}),
				RundownBaselineAdLibActions.findOneAsync(adLibId as RundownBaselineAdLibActionId, {
					projection: { _id: 1, actionId: 1, userData: 1 },
				}),
			]
		)
		const adLibActionDoc = adLibAction ?? baselineAdLibAction
		const regularAdLibDoc = baselineAdLibDoc ?? segmentAdLibDoc ?? bucketAdLibDoc
		if (regularAdLibDoc) {
			// This is an AdLib Piece

			if (adLibOptions) {
				return ClientAPI.responseError(
					UserError.from(
						Error(`AdLib options can not be provided for AdLib pieces`),
						UserErrorMessage.AdlibUnplayable
					),
					412
				)
			}

			const pieceType = baselineAdLibDoc ? 'baseline' : segmentAdLibDoc ? 'normal' : 'bucket'
			const rundownPlaylist = await RundownPlaylists.findOneAsync(rundownPlaylistId, {
				projection: { currentPartInfo: 1 },
			})
			if (!rundownPlaylist)
				return ClientAPI.responseError(
					UserError.from(
						new Error(`Rundown playlist does not exist`),
						UserErrorMessage.RundownPlaylistNotFound
					),
					404
				)
			if (rundownPlaylist.currentPartInfo === null)
				return ClientAPI.responseError(
					UserError.from(Error(`No active Part in ${rundownPlaylistId}`), UserErrorMessage.PartNotFound),
					412
				)

			const result = await ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
				ServerRestAPI.getMethodContext(connection),
				event,
				getCurrentTime(),
				rundownPlaylistId,
				() => {
					check(rundownPlaylistId, String)
					check(adLibId, Match.OneOf(String, null))
				},
				StudioJobs.AdlibPieceStart,
				{
					playlistId: rundownPlaylistId,
					adLibPieceId: regularAdLibDoc._id,
					partInstanceId: rundownPlaylist.currentPartInfo.partInstanceId,
					pieceType,
				}
			)
			if (ClientAPI.isClientResponseError(result)) return result
			return ClientAPI.responseSuccess({})
		} else if (adLibActionDoc) {
			// This is an AdLib Action

			const rundownPlaylist = await RundownPlaylists.findOneAsync(rundownPlaylistId, {
				projection: { currentPartInfo: 1, activationId: 1 },
			})

			if (!rundownPlaylist)
				return ClientAPI.responseError(
					UserError.from(
						new Error(`Rundown playlist does not exist`),
						UserErrorMessage.RundownPlaylistNotFound
					),
					404
				)
			if (!rundownPlaylist.activationId)
				return ClientAPI.responseError(
					UserError.from(
						new Error(`Rundown playlist ${rundownPlaylistId} is not currently active`),
						UserErrorMessage.InactiveRundown
					),
					412
				)
			if (!rundownPlaylist.currentPartInfo)
				return ClientAPI.responseError(
					UserError.from(
						new Error(`Rundown playlist ${rundownPlaylistId} must be playing`),
						UserErrorMessage.NoCurrentPart
					),
					412
				)

			const result = await ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
				ServerRestAPI.getMethodContext(connection),
				event,
				getCurrentTime(),
				rundownPlaylistId,
				() => {
					check(rundownPlaylistId, String)
					check(adLibId, Match.OneOf(String, null))
				},
				StudioJobs.ExecuteAction,
				{
					playlistId: rundownPlaylistId,
					actionDocId: adLibActionDoc._id,
					actionId: adLibActionDoc.actionId,
					userData: adLibOptions ?? adLibActionDoc.userData,
					triggerMode: triggerMode ? triggerMode : undefined,
				}
			)

			if (ClientAPI.isClientResponseError(result)) {
				throw new Meteor.Error(
					500,
					`AdLib Action execution failed`,
					JSON.stringify([{ message: result.error.rawError.message }])
				)
			}

			const validationErrors = result.result?.validationErrors
			if (validationErrors) {
				const details = JSON.stringify(validationErrors, null, 2)
				throw new Meteor.Error(409, `AdLib Action validation failed`, details)
			}

			return result
		} else {
			return ClientAPI.responseError(
				UserError.from(new Error(`No adLib with Id ${adLibId}`), UserErrorMessage.AdlibNotFound),
				412
			)
		}
	}
	async moveNextPart(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId,
		delta: number
	): Promise<ClientAPI.ClientResponse<PartId | null>> {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			ServerRestAPI.getMethodContext(connection),
			event,
			getCurrentTime(),
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
				check(delta, Number)
			},
			StudioJobs.MoveNextPart,
			{
				playlistId: rundownPlaylistId,
				partDelta: delta,
				segmentDelta: 0,
			}
		)
	}
	async moveNextSegment(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId,
		delta: number
	): Promise<ClientAPI.ClientResponse<PartId | null>> {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			ServerRestAPI.getMethodContext(connection),
			event,
			getCurrentTime(),
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
				check(delta, Number)
			},
			StudioJobs.MoveNextPart,
			{
				playlistId: rundownPlaylistId,
				partDelta: 0,
				segmentDelta: delta,
			}
		)
	}

	async reloadPlaylist(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId
	): Promise<ClientAPI.ClientResponse<object>> {
		return ServerClientAPI.runUserActionInLogForPlaylist<object>(
			ServerRestAPI.getMethodContext(connection),
			event,
			getCurrentTime(),
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
			},
			'reloadPlaylist',
			[rundownPlaylistId],
			async (access) => {
				const reloadResponse = await ServerRundownAPI.resyncRundownPlaylist(access)
				const success = !reloadResponse.rundownsResponses.reduce((missing, rundownsResponse) => {
					return missing || rundownsResponse.response === TriggerReloadDataResponse.MISSING
				}, false)
				return success
					? {}
					: UserError.from(
							new Error(`Failed to reload playlist ${rundownPlaylistId}`),
							UserErrorMessage.InternalError
					  )
			}
		)
	}

	async resetPlaylist(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId
	): Promise<ClientAPI.ClientResponse<void>> {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			ServerRestAPI.getMethodContext(connection),
			event,
			getCurrentTime(),
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
			},
			StudioJobs.ResetRundownPlaylist,
			{
				playlistId: rundownPlaylistId,
			}
		)
	}
	async setNextSegment(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId,
		segmentId: SegmentId
	): Promise<ClientAPI.ClientResponse<void>> {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			ServerRestAPI.getMethodContext(connection),
			event,
			getCurrentTime(),
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
				check(segmentId, String)
			},
			StudioJobs.SetNextSegment,
			{
				playlistId: rundownPlaylistId,
				nextSegmentId: segmentId,
			}
		)
	}
	async setNextPart(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId,
		partId: PartId
	): Promise<ClientAPI.ClientResponse<void>> {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			ServerRestAPI.getMethodContext(connection),
			event,
			getCurrentTime(),
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
				check(partId, String)
			},
			StudioJobs.SetNextPart,
			{
				playlistId: rundownPlaylistId,
				nextPartId: partId,
			}
		)
	}

	async take(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId,
		fromPartInstanceId: PartInstanceId | undefined
	): Promise<ClientAPI.ClientResponse<void>> {
		triggerWriteAccess()
		const rundownPlaylist = await RundownPlaylists.findOneAsync(rundownPlaylistId)
		if (!rundownPlaylist) throw new Error(`Rundown playlist ${rundownPlaylistId} does not exist`)

		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			ServerRestAPI.getMethodContext(connection),
			event,
			getCurrentTime(),
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
			},
			StudioJobs.TakeNextPart,
			{
				playlistId: rundownPlaylistId,
				fromPartInstanceId: fromPartInstanceId ?? rundownPlaylist.currentPartInfo?.partInstanceId ?? null,
			}
		)
	}

	async switchRouteSet(
		connection: Meteor.Connection,
		event: string,
		studioId: StudioId,
		routeSetId: string,
		state: boolean
	) {
		return ServerClientAPI.runUserActionInLog(
			ServerRestAPI.getMethodContext(connection),
			event,
			getCurrentTime(),
			'switchRouteSet',
			[studioId, routeSetId, state],
			async () => {
				check(studioId, String)
				check(routeSetId, String)
				check(state, Boolean)

				const access = await StudioContentWriteAccess.routeSet(
					ServerRestAPI.getCredentials(connection),
					studioId
				)
				return ServerPlayoutAPI.switchRouteSet(access, routeSetId, state)
			}
		)
	}

	async clearSourceLayer(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId,
		sourceLayerId: string
	): Promise<ClientAPI.ClientResponse<void>> {
		const rundownPlaylist = await RundownPlaylists.findOneAsync(rundownPlaylistId)
		if (!rundownPlaylist)
			return ClientAPI.responseError(
				UserError.from(
					Error(`Rundown playlist ${rundownPlaylistId} does not exist`),
					UserErrorMessage.RundownPlaylistNotFound
				),
				412
			)
		if (!rundownPlaylist.currentPartInfo?.partInstanceId || !rundownPlaylist.activationId)
			return ClientAPI.responseError(
				UserError.from(
					new Error(`Rundown playlist ${rundownPlaylistId} is not currently active`),
					UserErrorMessage.InactiveRundown
				),
				412
			)

		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			ServerRestAPI.getMethodContext(connection),
			event,
			getCurrentTime(),
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
				check(sourceLayerId, String)
			},
			StudioJobs.StopPiecesOnSourceLayers,
			{
				playlistId: rundownPlaylistId,
				partInstanceId: rundownPlaylist.currentPartInfo.partInstanceId,
				sourceLayerIds: [sourceLayerId],
			}
		)
	}

	async recallStickyPiece(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId,
		sourceLayerId: string
	): Promise<ClientAPI.ClientResponse<void>> {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			ServerRestAPI.getMethodContext(connection),
			event,
			getCurrentTime(),
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
				check(sourceLayerId, String)
			},
			StudioJobs.StartStickyPieceOnSourceLayer,
			{
				playlistId: rundownPlaylistId,
				sourceLayerId,
			}
		)
	}

	async getPeripheralDevices(
		_connection: Meteor.Connection,
		_event: string
	): Promise<ClientAPI.ClientResponse<Record<string, string[]>>> {
		const peripheralDevices = (await PeripheralDevices.findFetchAsync(
			{},
			{ projection: { _id: 1, category: 1 } }
		)) as Array<Pick<PeripheralDevice, '_id' | 'category'>>
		const apiDeviceRecords: Record<PeripheralDeviceCategory, string[]> = {
			ingest: [],
			playout: [],
			media_manager: [],
			package_manager: [],
			live_status: [],
			trigger_input: [],
		}
		peripheralDevices.forEach((dev) => apiDeviceRecords[dev.category].push(unprotectString(dev._id)))
		return ClientAPI.responseSuccess(apiDeviceRecords)
	}

	async getPeripheralDevice(
		_connection: Meteor.Connection,
		_event: string,
		deviceId: PeripheralDeviceId
	): Promise<ClientAPI.ClientResponse<APIPeripheralDevice>> {
		const device = await PeripheralDevices.findOneAsync(deviceId)
		if (!device)
			return ClientAPI.responseError(
				UserError.from(
					new Error(`Device ${deviceId} does not exist`),
					UserErrorMessage.PeripheralDeviceNotFound
				),
				404
			)
		return ClientAPI.responseSuccess(APIPeripheralDeviceFrom(device))
	}

	async peripheralDeviceAction(
		_connection: Meteor.Connection,
		_event: string,
		deviceId: PeripheralDeviceId,
		action: PeripheralDeviceActionRestart
	): Promise<ClientAPI.ClientResponse<void>> {
		const device = await PeripheralDevices.findOneAsync(deviceId)
		if (!device)
			return ClientAPI.responseError(
				UserError.from(
					new Error(`Device ${deviceId} does not exist`),
					UserErrorMessage.PeripheralDeviceNotFound
				),
				404
			)

		switch (action.type) {
			case PeripheralDeviceActionType.RESTART:
				// This dispatches the command but does not wait for it to complete
				await executePeripheralDeviceFunction(deviceId, 'killProcess', 1).catch(logger.error)
				break
			default:
				assertNever(action.type)
		}

		return ClientAPI.responseSuccess(undefined, 202)
	}

	async getPeripheralDevicesForStudio(
		_connection: Meteor.Connection,
		_event: string,
		studioId: StudioId
	): Promise<ClientAPI.ClientResponse<Record<string, string[]>>> {
		const peripheralDevices = (await PeripheralDevices.findFetchAsync(
			{ studioId },
			{ projection: { _id: 1, category: 1 } }
		)) as Array<Pick<PeripheralDevice, '_id' | 'category'>>
		const apiDeviceRecords: Record<PeripheralDeviceCategory, string[]> = {
			ingest: [],
			playout: [],
			media_manager: [],
			package_manager: [],
			live_status: [],
			trigger_input: [],
		}
		peripheralDevices.forEach((dev) => apiDeviceRecords[dev.category].push(unprotectString(dev._id)))
		return ClientAPI.responseSuccess(apiDeviceRecords)
	}

	async getAllBlueprints(
		_connection: Meteor.Connection,
		_event: string
	): Promise<ClientAPI.ClientResponse<Array<{ id: string }>>> {
		const blueprints = (await Blueprints.findFetchAsync({}, { projection: { _id: 1 } })) as Array<
			Pick<Blueprint, '_id'>
		>

		return ClientAPI.responseSuccess(blueprints.map((blueprint) => ({ id: unprotectString(blueprint._id) })))
	}

	async getBlueprint(
		_connection: Meteor.Connection,
		_event: string,
		blueprintId: BlueprintId
	): Promise<ClientAPI.ClientResponse<APIBlueprint>> {
		const blueprint = await Blueprints.findOneAsync(blueprintId)
		if (!blueprint) {
			return ClientAPI.responseError(
				UserError.from(new Error(`Blueprint ${blueprintId} not found`), UserErrorMessage.BlueprintNotFound),
				404
			)
		}

		const apiBlueprint = APIBlueprintFrom(blueprint)
		if (!apiBlueprint) throw new Error(`Blueprint could not be converted to API representation`)
		return ClientAPI.responseSuccess(apiBlueprint)
	}

	async assignSystemBlueprint(
		_connection: Meteor.Connection,
		_event: string,
		blueprintId: BlueprintId
	): Promise<ClientAPI.ClientResponse<void>> {
		return ClientAPI.responseSuccess(await MeteorCall.blueprint.assignSystemBlueprint(blueprintId))
	}

	async unassignSystemBlueprint(
		_connection: Meteor.Connection,
		_event: string
	): Promise<ClientAPI.ClientResponse<void>> {
		return ClientAPI.responseSuccess(await MeteorCall.blueprint.assignSystemBlueprint(undefined))
	}

	async attachDeviceToStudio(
		_connection: Meteor.Connection,
		_event: string,
		studioId: StudioId,
		deviceId: PeripheralDeviceId
	): Promise<ClientAPI.ClientResponse<void>> {
		const studio = await Studios.findOneAsync(studioId)
		if (!studio)
			return ClientAPI.responseError(
				UserError.from(new Error(`Studio does not exist`), UserErrorMessage.StudioNotFound),
				404
			)

		const device = await PeripheralDevices.findOneAsync(deviceId)
		if (!device)
			return ClientAPI.responseError(
				UserError.from(new Error(`Studio does not exist`), UserErrorMessage.PeripheralDeviceNotFound),
				404
			)

		if (device.studioId !== undefined && device.studioId !== studio._id) {
			return ClientAPI.responseError(
				UserError.from(
					new Error(`Device already attached to studio`),
					UserErrorMessage.DeviceAlreadyAttachedToStudio
				),
				412
			)
		}
		await PeripheralDevices.updateAsync(deviceId, {
			$set: {
				studioId,
			},
		})

		return ClientAPI.responseSuccess(undefined, 200)
	}

	async detachDeviceFromStudio(
		_connection: Meteor.Connection,
		_event: string,
		studioId: StudioId,
		deviceId: PeripheralDeviceId
	) {
		const studio = await Studios.findOneAsync(studioId)
		if (!studio)
			return ClientAPI.responseError(
				UserError.from(new Error(`Studio does not exist`), UserErrorMessage.StudioNotFound),
				404
			)
		await PeripheralDevices.updateAsync(deviceId, {
			$unset: {
				studioId: 1,
			},
		})

		return ClientAPI.responseSuccess(undefined, 200)
	}

	async getShowStyleBases(
		_connection: Meteor.Connection,
		_event: string
	): Promise<ClientAPI.ClientResponse<Array<{ id: string }>>> {
		const showStyleBases = (await ShowStyleBases.findFetchAsync({}, { projection: { _id: 1 } })) as Array<
			Pick<ShowStyleBase, '_id'>
		>
		return ClientAPI.responseSuccess(showStyleBases.map((base) => ({ id: unprotectString(base._id) })))
	}

	async addShowStyleBase(
		_connection: Meteor.Connection,
		_event: string,
		apiShowStyleBase: APIShowStyleBase
	): Promise<ClientAPI.ClientResponse<string>> {
		const blueprintConfigValidation = await validateAPIBlueprintConfigForShowStyle(
			apiShowStyleBase,
			protectString(apiShowStyleBase.blueprintId)
		)
		const blueprintConfigValidationOK = blueprintConfigValidation.reduce(
			(acc, msg) => acc && msg.level === NoteSeverity.INFO,
			true
		)
		if (!blueprintConfigValidationOK) {
			const details = JSON.stringify(
				blueprintConfigValidation.filter((msg) => msg.level < NoteSeverity.INFO).map((msg) => msg.message.key),
				null,
				2
			)
			logger.error(`addShowStyleBase failed blueprint config validation with errors: ${details}`)
			throw new Meteor.Error(409, `ShowStyleBase has failed blueprint config validation`, details)
		}

		const showStyle = await showStyleBaseFrom(apiShowStyleBase)
		if (!showStyle) throw new Meteor.Error(400, `Invalid ShowStyleBase`)
		const showStyleId = showStyle._id
		await ShowStyleBases.insertAsync(showStyle)

		return ClientAPI.responseSuccess(unprotectString(showStyleId), 200)
	}

	async getShowStyleBase(
		_connection: Meteor.Connection,
		_event: string,
		showStyleBaseId: ShowStyleBaseId
	): Promise<ClientAPI.ClientResponse<APIShowStyleBase>> {
		const showStyleBase = await ShowStyleBases.findOneAsync(showStyleBaseId)
		if (!showStyleBase) throw new Meteor.Error(404, `ShowStyleBase ${showStyleBaseId} does not exist`)

		return ClientAPI.responseSuccess(await APIShowStyleBaseFrom(showStyleBase))
	}

	async addOrUpdateShowStyleBase(
		_connection: Meteor.Connection,
		_event: string,
		showStyleBaseId: ShowStyleBaseId,
		apiShowStyleBase: APIShowStyleBase
	): Promise<ClientAPI.ClientResponse<void>> {
		const blueprintConfigValidation = await validateAPIBlueprintConfigForShowStyle(
			apiShowStyleBase,
			protectString(apiShowStyleBase.blueprintId)
		)
		const blueprintConfigValidationOK = blueprintConfigValidation.reduce(
			(acc, msg) => acc && msg.level === NoteSeverity.INFO,
			true
		)
		if (!blueprintConfigValidationOK) {
			const details = JSON.stringify(
				blueprintConfigValidation.filter((msg) => msg.level < NoteSeverity.INFO).map((msg) => msg.message.key),
				null,
				2
			)
			logger.error(`addOrUpdateShowStyleBase failed blueprint config validation with errors: ${details}`)
			throw new Meteor.Error(
				409,
				`ShowStyleBase ${showStyleBaseId} has failed blueprint config validation`,
				details
			)
		}

		const showStyle = await showStyleBaseFrom(apiShowStyleBase, showStyleBaseId)
		if (!showStyle) throw new Meteor.Error(400, `Invalid ShowStyleBase`)

		const existingShowStyle = await ShowStyleBases.findOneAsync(showStyleBaseId)
		if (existingShowStyle) {
			const rundowns = (await Rundowns.findFetchAsync(
				{ showStyleBaseId },
				{ projection: { playlistId: 1 } }
			)) as Array<Pick<Rundown, 'playlistId'>>
			const playlists = (await RundownPlaylists.findFetchAsync(
				{ _id: { $in: rundowns.map((r) => r.playlistId) } },
				{
					projection: {
						activationId: 1,
					},
				}
			)) as Array<Pick<RundownPlaylist, 'activationId'>>
			if (playlists.some((playlist) => playlist.activationId !== undefined)) {
				throw new Meteor.Error(
					412,
					`Cannot update ShowStyleBase ${showStyleBaseId} as it is in use by an active Playlist`
				)
			}
		}

		await ShowStyleBases.upsertAsync(showStyleBaseId, showStyle)

		const validation = await validateConfigForShowStyleBase(showStyleBaseId)
		const validateOK = validation.messages.reduce((acc, msg) => acc && msg.level === NoteSeverity.INFO, true)
		if (!validateOK) {
			const details = JSON.stringify(
				validation.messages.filter((msg) => msg.level < NoteSeverity.INFO).map((msg) => msg.message.key),
				null,
				2
			)
			logger.error(`addOrUpdateShowStyleBase failed validation with errors: ${details}`)
			throw new Meteor.Error(409, `ShowStyleBase ${showStyleBaseId} has failed validation`, details)
		}

		return ClientAPI.responseSuccess(await runUpgradeForShowStyleBase(showStyleBaseId))
	}

	async deleteShowStyleBase(
		_connection: Meteor.Connection,
		_event: string,
		showStyleBaseId: ShowStyleBaseId
	): Promise<ClientAPI.ClientResponse<void>> {
		const rundowns = (await Rundowns.findFetchAsync(
			{ showStyleBaseId },
			{ projection: { playlistId: 1 } }
		)) as Array<Pick<Rundown, 'playlistId'>>
		const playlists = (await RundownPlaylists.findFetchAsync(
			{ _id: { $in: rundowns.map((r) => r.playlistId) } },
			{
				projection: {
					activationId: 1,
				},
			}
		)) as Array<Pick<RundownPlaylist, 'activationId'>>
		if (playlists.some((playlist) => playlist.activationId !== undefined)) {
			throw new Meteor.Error(
				412,
				`Cannot delete ShowStyleBase ${showStyleBaseId} as it is in use by an active Playlist`
			)
		}

		await ShowStyleBases.removeAsync(showStyleBaseId)
		return ClientAPI.responseSuccess(undefined)
	}

	async getShowStyleConfig(
		_connection: Meteor.Connection,
		_event: string,
		showStyleBaseId: ShowStyleBaseId
	): Promise<ClientAPI.ClientResponse<object>> {
		const showStyleBase = await ShowStyleBases.findOneAsync(showStyleBaseId)
		if (!showStyleBase) throw new Meteor.Error(404, `ShowStyleBase ${showStyleBaseId} does not exist`)

		return ClientAPI.responseSuccess((await APIShowStyleBaseFrom(showStyleBase)).config)
	}

	async updateShowStyleConfig(
		_connection: Meteor.Connection,
		_event: string,
		showStyleBaseId: ShowStyleBaseId,
		config: object
	): Promise<ClientAPI.ClientResponse<void>> {
		const existingShowStyleBase = await ShowStyleBases.findOneAsync(showStyleBaseId)
		if (existingShowStyleBase) {
			const rundowns = (await Rundowns.findFetchAsync(
				{ showStyleBaseId },
				{ projection: { playlistId: 1 } }
			)) as Array<Pick<Rundown, 'playlistId'>>
			const playlists = (await RundownPlaylists.findFetchAsync(
				{ _id: { $in: rundowns.map((r) => r.playlistId) } },
				{
					projection: {
						activationId: 1,
					},
				}
			)) as Array<Pick<RundownPlaylist, 'activationId'>>
			if (playlists.some((playlist) => playlist.activationId !== undefined)) {
				throw new Meteor.Error(
					412,
					`Cannot update ShowStyleBase ${showStyleBaseId} as it is in use by an active Playlist`
				)
			}
		} else throw new Meteor.Error(404, `ShowStyleBase ${showStyleBaseId} not found`)

		const apiShowStyleBase = await APIShowStyleBaseFrom(existingShowStyleBase)
		apiShowStyleBase.config = config

		const blueprintConfigValidation = await validateAPIBlueprintConfigForShowStyle(
			apiShowStyleBase,
			protectString(apiShowStyleBase.blueprintId)
		)
		const blueprintConfigValidationOK = blueprintConfigValidation.reduce(
			(acc, msg) => acc && msg.level === NoteSeverity.INFO,
			true
		)
		if (!blueprintConfigValidationOK) {
			const details = JSON.stringify(
				blueprintConfigValidation.filter((msg) => msg.level < NoteSeverity.INFO).map((msg) => msg.message.key),
				null,
				2
			)
			logger.error(`updateShowStyleBase failed blueprint config validation with errors: ${details}`)
			throw new Meteor.Error(
				409,
				`ShowStyleBase ${showStyleBaseId} has failed blueprint config validation`,
				details
			)
		}

		const showStyle = await showStyleBaseFrom(apiShowStyleBase, showStyleBaseId)
		if (!showStyle) throw new Meteor.Error(400, `Invalid ShowStyleBase`)

		await ShowStyleBases.upsertAsync(showStyleBaseId, showStyle)

		const validation = await validateConfigForShowStyleBase(showStyleBaseId)
		const validateOK = validation.messages.reduce((acc, msg) => acc && msg.level === NoteSeverity.INFO, true)
		if (!validateOK) {
			const details = JSON.stringify(
				validation.messages.filter((msg) => msg.level < NoteSeverity.INFO).map((msg) => msg.message.key),
				null,
				2
			)
			logger.error(`updateShowStyleBase failed validation with errors: ${details}`)
			throw new Meteor.Error(409, `ShowStyleBase ${showStyleBaseId} has failed validation`, details)
		}

		return ClientAPI.responseSuccess(await runUpgradeForShowStyleBase(showStyleBaseId))
	}

	async getShowStyleVariants(
		_connection: Meteor.Connection,
		_event: string,
		showStyleBaseId: ShowStyleBaseId
	): Promise<ClientAPI.ClientResponse<Array<{ id: string }>>> {
		const showStyleBase = await ShowStyleBases.findOneAsync(showStyleBaseId)
		if (!showStyleBase) throw new Meteor.Error(404, `ShowStyleBase ${showStyleBaseId} not found`)

		const showStyleVariants = (await ShowStyleVariants.findFetchAsync(
			{ showStyleBaseId },
			{ projection: { _id: 1 } }
		)) as Array<Pick<ShowStyleVariant, '_id'>>

		return ClientAPI.responseSuccess(showStyleVariants.map((variant) => ({ id: unprotectString(variant._id) })))
	}

	async addShowStyleVariant(
		_connection: Meteor.Connection,
		_event: string,
		showStyleBaseId: ShowStyleBaseId,
		apiShowStyleVariant: APIShowStyleVariant
	): Promise<ClientAPI.ClientResponse<string>> {
		const showStyleBase = await ShowStyleBases.findOneAsync(showStyleBaseId)
		if (!showStyleBase) throw new Meteor.Error(404, `ShowStyleBase ${showStyleBaseId} not found`)

		const blueprintConfigValidation = await validateAPIBlueprintConfigForShowStyle(
			apiShowStyleVariant,
			showStyleBase.blueprintId
		)
		const blueprintConfigValidationOK = blueprintConfigValidation.reduce(
			(acc, msg) => acc && msg.level === NoteSeverity.INFO,
			true
		)
		if (!blueprintConfigValidationOK) {
			const details = JSON.stringify(
				blueprintConfigValidation.filter((msg) => msg.level < NoteSeverity.INFO).map((msg) => msg.message.key),
				null,
				2
			)
			logger.error(`addOrUpdateShowStyleBase failed blueprint config validation with errors: ${details}`)
			throw new Meteor.Error(
				409,
				`ShowStyleBase ${showStyleBaseId} has failed blueprint config validation`,
				details
			)
		}

		const variant = showStyleVariantFrom(apiShowStyleVariant)
		if (!variant) throw new Meteor.Error(400, `Invalid ShowStyleVariant`)

		const variantId = variant._id
		await ShowStyleVariants.insertAsync(variant)

		return ClientAPI.responseSuccess(unprotectString(variantId), 200)
	}

	async getShowStyleVariant(
		_connection: Meteor.Connection,
		_event: string,
		showStyleBaseId: ShowStyleBaseId,
		showStyleVariantId: ShowStyleVariantId
	): Promise<ClientAPI.ClientResponse<APIShowStyleVariant>> {
		const showStyleBase = await ShowStyleBases.findOneAsync(showStyleBaseId)
		if (!showStyleBase) throw new Meteor.Error(404, `ShowStyleBase ${showStyleBaseId} not found`)

		const variant = await ShowStyleVariants.findOneAsync(showStyleVariantId)
		if (!variant) throw new Meteor.Error(404, `ShowStyleVariant ${showStyleVariantId} not found`)

		return ClientAPI.responseSuccess(await APIShowStyleVariantFrom(showStyleBase, variant))
	}

	async addOrUpdateShowStyleVariant(
		_connection: Meteor.Connection,
		_event: string,
		showStyleBaseId: ShowStyleBaseId,
		showStyleVariantId: ShowStyleVariantId,
		apiShowStyleVariant: APIShowStyleVariant
	): Promise<ClientAPI.ClientResponse<void>> {
		const showStyleBase = await ShowStyleBases.findOneAsync(showStyleBaseId)
		if (!showStyleBase) throw new Meteor.Error(404, `ShowStyleBase ${showStyleBaseId} does not exist`)

		const blueprintConfigValidation = await validateAPIBlueprintConfigForShowStyle(
			apiShowStyleVariant,
			showStyleBase.blueprintId
		)
		const blueprintConfigValidationOK = blueprintConfigValidation.reduce(
			(acc, msg) => acc && msg.level === NoteSeverity.INFO,
			true
		)
		if (!blueprintConfigValidationOK) {
			const details = JSON.stringify(
				blueprintConfigValidation.filter((msg) => msg.level < NoteSeverity.INFO).map((msg) => msg.message.key),
				null,
				2
			)
			logger.error(`addOrUpdateShowStyleBase failed blueprint config validation with errors: ${details}`)
			throw new Meteor.Error(
				409,
				`ShowStyleBase ${showStyleBaseId} has failed blueprint config validation`,
				details
			)
		}

		const showStyle = showStyleVariantFrom(apiShowStyleVariant, showStyleVariantId)
		if (!showStyle) throw new Meteor.Error(400, `Invalid ShowStyleVariant`)

		const existingShowStyle = await ShowStyleVariants.findOneAsync(showStyleVariantId)
		if (existingShowStyle) {
			const rundowns = (await Rundowns.findFetchAsync(
				{ showStyleVariantId },
				{ projection: { playlistId: 1 } }
			)) as Array<Pick<Rundown, 'playlistId'>>
			const playlists = (await RundownPlaylists.findFetchAsync(
				{ _id: { $in: rundowns.map((r) => r.playlistId) } },
				{
					projection: {
						activationId: 1,
					},
				}
			)) as Array<Pick<RundownPlaylist, 'activationId'>>
			if (playlists.some((playlist) => playlist.activationId !== undefined)) {
				throw new Meteor.Error(
					412,
					`Cannot update ShowStyleVariant ${showStyleVariantId} as it is in use by an active Playlist`
				)
			}
		}

		await ShowStyleVariants.upsertAsync(showStyleVariantId, showStyle)
		return ClientAPI.responseSuccess(undefined, 200)
	}

	async deleteShowStyleVariant(
		_connection: Meteor.Connection,
		_event: string,
		showStyleBaseId: ShowStyleBaseId,
		showStyleVariantId: ShowStyleVariantId
	): Promise<ClientAPI.ClientResponse<void>> {
		const showStyleBase = await ShowStyleBases.findOneAsync(showStyleBaseId)
		if (!showStyleBase) throw new Meteor.Error(404, `ShowStyleBase ${showStyleBaseId} does not exist`)

		const rundowns = (await Rundowns.findFetchAsync(
			{ showStyleVariantId },
			{ projection: { playlistId: 1 } }
		)) as Array<Pick<Rundown, 'playlistId'>>
		const playlists = (await RundownPlaylists.findFetchAsync(
			{ _id: { $in: rundowns.map((r) => r.playlistId) } },
			{
				projection: {
					activationId: 1,
				},
			}
		)) as Array<Pick<RundownPlaylist, 'activationId'>>
		if (playlists.some((playlist) => playlist.activationId !== undefined)) {
			throw new Meteor.Error(
				412,
				`Cannot delete ShowStyleVariant ${showStyleVariantId} as it is in use by an active Playlist`
			)
		}

		await ShowStyleVariants.removeAsync(showStyleVariantId)
		return ClientAPI.responseSuccess(undefined, 200)
	}

	async getStudios(
		_connection: Meteor.Connection,
		_event: string
	): Promise<ClientAPI.ClientResponse<Array<{ id: string }>>> {
		const studios = (await Studios.findFetchAsync({}, { projection: { _id: 1 } })) as Array<Pick<Studio, '_id'>>

		return ClientAPI.responseSuccess(studios.map((studio) => ({ id: unprotectString(studio._id) })))
	}

	async addStudio(
		_connection: Meteor.Connection,
		_event: string,
		apiStudio: APIStudio
	): Promise<ClientAPI.ClientResponse<string>> {
		const blueprintConfigValidation = await validateAPIBlueprintConfigForStudio(apiStudio)
		const blueprintConfigValidationOK = blueprintConfigValidation.reduce(
			(acc, msg) => acc && msg.level === NoteSeverity.INFO,
			true
		)
		if (!blueprintConfigValidationOK) {
			const details = JSON.stringify(
				blueprintConfigValidation.filter((msg) => msg.level < NoteSeverity.INFO).map((msg) => msg.message.key),
				null,
				2
			)
			logger.error(`addOrUpdateStudio failed blueprint config validation with errors: ${details}`)
			throw new Meteor.Error(409, `Studio has failed blueprint config validation`, details)
		}

		const newStudio = await studioFrom(apiStudio)
		if (!newStudio) throw new Meteor.Error(400, `Invalid Studio`)

		const newStudioId = await Studios.insertAsync(newStudio)

		const validation = await validateConfigForStudio(newStudioId)
		const validateOK = validation.messages.reduce((acc, msg) => acc && msg.level === NoteSeverity.INFO, true)
		if (!validateOK) {
			const details = JSON.stringify(
				validation.messages.filter((msg) => msg.level < NoteSeverity.INFO).map((msg) => msg.message.key),
				null,
				2
			)
			logger.error(`addStudio failed validation with errors: ${details}`)
			throw new Meteor.Error(409, `Studio ${newStudioId} has failed validation`, details)
		}

		await runUpgradeForStudio(newStudioId)
		return ClientAPI.responseSuccess(unprotectString(newStudioId), 200)
	}

	async getStudio(
		_connection: Meteor.Connection,
		_event: string,
		studioId: StudioId
	): Promise<ClientAPI.ClientResponse<APIStudio>> {
		const studio = await Studios.findOneAsync(studioId)
		if (!studio) throw new Meteor.Error(404, `Studio ${studioId} not found`)

		return ClientAPI.responseSuccess(await APIStudioFrom(studio))
	}

	async addOrUpdateStudio(
		_connection: Meteor.Connection,
		_event: string,
		studioId: StudioId,
		apiStudio: APIStudio
	): Promise<ClientAPI.ClientResponse<void>> {
		const blueprintConfigValidation = await validateAPIBlueprintConfigForStudio(apiStudio)
		const blueprintConfigValidationOK = blueprintConfigValidation.reduce(
			(acc, msg) => acc && msg.level === NoteSeverity.INFO,
			true
		)
		if (!blueprintConfigValidationOK) {
			const details = JSON.stringify(
				blueprintConfigValidation.filter((msg) => msg.level < NoteSeverity.INFO).map((msg) => msg.message.key),
				null,
				2
			)
			logger.error(`addOrUpdateStudio failed blueprint config validation with errors: ${details}`)
			throw new Meteor.Error(409, `Studio ${studioId} has failed blueprint config validation`, details)
		}

		const newStudio = await studioFrom(apiStudio, studioId)
		if (!newStudio) throw new Meteor.Error(400, `Invalid Studio`)

		const existingStudio = await Studios.findOneAsync(studioId)
		if (existingStudio) {
			const playlists = (await RundownPlaylists.findFetchAsync(
				{ studioId },
				{
					projection: {
						activationId: 1,
					},
				}
			)) as Array<Pick<RundownPlaylist, 'activationId'>>
			if (playlists.some((p) => p.activationId !== undefined)) {
				throw new Meteor.Error(412, `Studio ${studioId} cannot be updated, it is in use in an active Playlist`)
			}
		}

		await Studios.upsertAsync(studioId, newStudio)

		const validation = await validateConfigForStudio(studioId)
		const validateOK = validation.messages.reduce((acc, msg) => acc && msg.level === NoteSeverity.INFO, true)
		if (!validateOK) {
			const details = JSON.stringify(
				validation.messages.filter((msg) => msg.level < NoteSeverity.INFO).map((msg) => msg.message.key),
				null,
				2
			)
			logger.error(`addOrUpdateStudio failed validation with errors: ${details}`)
			throw new Meteor.Error(409, `Studio ${studioId} has failed validation`, details)
		}

		return ClientAPI.responseSuccess(await runUpgradeForStudio(studioId))
	}

	async getStudioConfig(
		_connection: Meteor.Connection,
		_event: string,
		studioId: StudioId
	): Promise<ClientAPI.ClientResponse<object>> {
		const studio = await Studios.findOneAsync(studioId)
		if (!studio) throw new Meteor.Error(404, `Studio ${studioId} not found`)

		return ClientAPI.responseSuccess((await APIStudioFrom(studio)).config)
	}

	async updateStudioConfig(
		_connection: Meteor.Connection,
		_event: string,
		studioId: StudioId,
		config: object
	): Promise<ClientAPI.ClientResponse<void>> {
		const existingStudio = await Studios.findOneAsync(studioId)
		if (!existingStudio) {
			throw new Meteor.Error(404, `Studio ${studioId} not found`)
		}

		const apiStudio = await APIStudioFrom(existingStudio)
		apiStudio.config = config

		const blueprintConfigValidation = await validateAPIBlueprintConfigForStudio(apiStudio)
		const blueprintConfigValidationOK = blueprintConfigValidation.reduce(
			(acc, msg) => acc && msg.level === NoteSeverity.INFO,
			true
		)
		if (!blueprintConfigValidationOK) {
			const details = JSON.stringify(
				blueprintConfigValidation.filter((msg) => msg.level < NoteSeverity.INFO).map((msg) => msg.message.key),
				null,
				2
			)
			logger.error(`updateStudioConfig failed blueprint config validation with errors: ${details}`)
			throw new Meteor.Error(409, `Studio ${studioId} has failed blueprint config validation`, details)
		}

		const newStudio = await studioFrom(apiStudio, studioId)
		if (!newStudio) throw new Meteor.Error(400, `Invalid Studio`)

		await Studios.upsertAsync(studioId, newStudio)

		const validation = await validateConfigForStudio(studioId)
		const validateOK = validation.messages.reduce((acc, msg) => acc && msg.level === NoteSeverity.INFO, true)
		if (!validateOK) {
			const details = JSON.stringify(
				validation.messages.filter((msg) => msg.level < NoteSeverity.INFO).map((msg) => msg.message.key),
				null,
				2
			)
			logger.error(`updateStudioConfig failed validation with errors: ${details}`)
			throw new Meteor.Error(409, `Studio ${studioId} has failed validation`, details)
		}

		return ClientAPI.responseSuccess(await runUpgradeForStudio(studioId))
	}

	async deleteStudio(
		connection: Meteor.Connection,
		event: string,
		studioId: StudioId
	): Promise<ClientAPI.ClientResponse<void>> {
		const existingStudio = await Studios.findOneAsync(studioId)
		if (existingStudio) {
			const playlists = (await RundownPlaylists.findFetchAsync(
				{ studioId },
				{
					projection: {
						activationId: 1,
					},
				}
			)) as Array<Pick<RundownPlaylist, 'activationId'>>
			if (playlists.some((p) => p.activationId !== undefined)) {
				throw new Meteor.Error(412, `Studio ${studioId} cannot be deleted, it is in use in an active Playlist`)
			}
		}

		await PeripheralDevices.updateAsync({ studioId }, { $unset: { studioId: 1 } })

		const rundownPlaylists = (await RundownPlaylists.findFetchAsync(
			{ studioId },
			{
				projection: {
					_id: 1,
				},
			}
		)) as Array<Pick<RundownPlaylist, '_id'>>

		const promises = rundownPlaylists.map(async (rundownPlaylist) =>
			ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
				ServerRestAPI.getMethodContext(connection),
				event,
				getCurrentTime(),
				rundownPlaylist._id,
				() => {
					check(rundownPlaylist._id, String)
				},
				StudioJobs.RemovePlaylist,
				{
					playlistId: rundownPlaylist._id,
				}
			)
		)

		await Promise.all(promises)
		await Studios.removeAsync(studioId)

		return ClientAPI.responseSuccess(undefined, 200)
	}

	async studioAction(
		_connection: Meteor.Connection,
		_event: string,
		studioId: StudioId,
		action: StudioAction
	): Promise<ClientAPI.ClientResponse<void>> {
		switch (action.type) {
			case StudioActionType.BLUEPRINT_UPGRADE:
				return ClientAPI.responseSuccess(await runUpgradeForStudio(studioId))
			default:
				assertNever(action.type)
				throw new Meteor.Error(400, `Invalid action type`)
		}
	}

	async showStyleBaseAction(
		_connection: Meteor.Connection,
		_event: string,
		showStyleBaseId: ShowStyleBaseId,
		action: ShowStyleBaseAction
	): Promise<ClientAPI.ClientResponse<void>> {
		switch (action.type) {
			case ShowStyleBaseActionType.BLUEPRINT_UPGRADE:
				return ClientAPI.responseSuccess(await runUpgradeForShowStyleBase(showStyleBaseId))
			default:
				assertNever(action.type)
				throw new Meteor.Error(400, `Invalid action type`)
		}
	}

	async getPendingMigrations(
		_connection: Meteor.Connection,
		_event: string
	): Promise<ClientAPI.ClientResponse<{ inputs: PendingMigrations }>> {
		const migrationStatus = await MeteorCall.migration.getMigrationStatus()
		if (!migrationStatus.migrationNeeded) return ClientAPI.responseSuccess({ inputs: [] })

		const requiredInputs: PendingMigrations = []
		for (const migration of migrationStatus.migration.manualInputs) {
			if (migration.stepId && migration.attribute) {
				requiredInputs.push({
					stepId: migration.stepId,
					attributeId: migration.attribute,
				})
			}
		}

		return ClientAPI.responseSuccess({ inputs: requiredInputs })
	}

	async applyPendingMigrations(
		_connection: Meteor.Connection,
		_event: string,
		inputs: MigrationData
	): Promise<ClientAPI.ClientResponse<void>> {
		const migrationStatus = await MeteorCall.migration.getMigrationStatus()
		if (!migrationStatus.migrationNeeded) throw new Error(`Migration does not need to be applied`)

		const migrationData: MigrationStepInputResult[] = inputs.map((input) => ({
			stepId: input.stepId,
			attribute: input.attributeId,
			value: input.migrationValue,
		}))
		const result = await MeteorCall.migration.runMigration(
			migrationStatus.migration.chunks,
			migrationStatus.migration.hash,
			migrationData
		)
		if (result.migrationCompleted) return ClientAPI.responseSuccess(undefined)
		throw new Error(`Unknown error occurred`)
	}
}

export const koaRouter = new KoaRouter()
koaRouter.use(bodyParser())

function extractErrorCode(e: unknown): number {
	if (ClientAPI.isClientResponseError(e)) {
		return e.errorCode
	} else if (UserError.isUserError(e)) {
		return e.errorCode
	} else if ((e as Meteor.Error).error && typeof (e as Meteor.Error).error === 'number') {
		return (e as Meteor.Error).error as number
	} else {
		return 500
	}
}

function extractErrorMessage(e: unknown): string {
	if (ClientAPI.isClientResponseError(e)) {
		return translateMessage(e.error.message, interpollateTranslation)
	} else if (UserError.isUserError(e)) {
		return translateMessage(e.message, interpollateTranslation)
	} else if ((e as Meteor.Error).reason && typeof (e as Meteor.Error).reason === 'string') {
		return (e as Meteor.Error).reason as string
	} else {
		return (e as Error).message ?? 'Internal Server Error' // Fallback in case e is not an error type
	}
}

function extractErrorDetails(e: unknown): string[] | undefined {
	if ((e as Meteor.Error).details && typeof (e as Meteor.Error).details === 'string') {
		try {
			const details = JSON.parse((e as Meteor.Error).details as string) as string[]
			return Array.isArray(details) ? details : undefined
		} catch (e) {
			logger.error(`Failed to parse details to string array: ${(e as Meteor.Error).details}`)
			return undefined
		}
	} else {
		return undefined
	}
}

interface APIRequestError {
	status: number
	message: string
	details?: string[]
}

function sofieAPIRequest<API, Params, Body, Response>(
	method: 'get' | 'post' | 'put' | 'delete',
	route: string,
	errMsgs: Map<number, UserErrorMessage[]>,
	serverAPIFactory: APIFactory<API>,
	handler: (
		serverAPI: API,
		connection: Meteor.Connection,
		event: string,
		params: Params,
		body: Body
	) => Promise<ClientAPI.ClientResponse<Response>>
) {
	koaRouter[method](route, async (ctx, next) => {
		try {
			const context = new APIContext()
			const serverAPI = serverAPIFactory.createServerAPI(context)
			const response = await handler(
				serverAPI,
				makeMeteorConnectionFromKoa(ctx),
				restAPIUserEvent(ctx),
				ctx.params as unknown as Params,
				ctx.request.body as unknown as Body
			)
			if (ClientAPI.isClientResponseError(response)) throw response
			ctx.type = 'application/json'
			ctx.body = JSON.stringify({ status: response.success, result: response.result })
			ctx.status = response.success
		} catch (e) {
			const errCode = extractErrorCode(e)
			let errMsg = extractErrorMessage(e)
			const msgs = errMsgs.get(errCode)
			if (msgs) {
				const msgConcat = {
					key: msgs
						.map((msg) => UserError.create(msg, undefined, errCode).message.key)
						.reduce((acc, msg) => acc + (acc.length ? ' or ' : '') + msg, ''),
				}
				errMsg = translateMessage(msgConcat, interpollateTranslation)
			} else {
				logger.error(
					`${method.toUpperCase()} for route ${route} returned unexpected error code ${errCode} - ${errMsg}`
				)
			}

			logger.error(`${method.toUpperCase()} failed for route ${route}: ${errCode} - ${errMsg}`)
			ctx.type = 'application/json'
			const bodyObj: APIRequestError = { status: errCode, message: errMsg }
			const details = extractErrorDetails(e)
			if (details) bodyObj['details'] = details
			ctx.body = JSON.stringify(bodyObj)
			ctx.status = errCode
		}
		await next()
	})
}

/* ****************************************************************************
  IMPORTANT: IF YOU MAKE ANY MODIFICATIONS TO THE API, YOU MUST ENSURE THAT
  THEY ARE REFLECTED IN THE OPENAPI SPECIFICATION FILES
  (/packages/openapi/api/definitions)
**************************************************************************** */

class IndexServerAPI {
	async index(): Promise<ClientAPI.ClientResponse<{ version: string }>> {
		triggerWriteAccess()

		return ClientAPI.responseSuccess({ version: CURRENT_SYSTEM_VERSION })
	}
}

koaRouter.get('/', async (ctx, next) => {
	ctx.type = 'application/json'
	const server = new IndexServerAPI()
	const response = ClientAPI.responseSuccess(await server.index())
	ctx.body = JSON.stringify({ status: response.success, result: response.result })
	ctx.status = response.success
	await next()
})

koaRouter.get('/health', async (ctx, next) => {
	ctx.type = 'application/json'
	const systemStatus = await getSystemStatus({ userId: null })
	const coreVersion = systemStatus._internal.versions['core'] ?? 'unknown'
	const blueprint = Object.keys(systemStatus._internal.versions).find((component) =>
		component.startsWith('blueprint')
	)
	const blueprintsVersion = blueprint ? systemStatus._internal.versions[blueprint] : 'unknown'

	interface ComponentStatus {
		name: string
		updated: string
		status: ExternalStatus
		version?: string
		components?: ComponentStatus[]
		statusMessage?: string
	}

	// Array of all devices that have a parentId
	const subComponents =
		systemStatus.components?.filter((c) => c.instanceId !== undefined && c.parentId !== undefined) ?? []

	function mapComponents(components?: Component[]): ComponentStatus[] | undefined {
		return (
			components?.map((c) => {
				const version = c._internal.versions['_process']
				const children = subComponents.filter((sub) => sub.parentId === c.instanceId)
				return {
					name: c.name,
					updated: c.updated,
					status: c.status,
					version: version ?? undefined,
					components: children.length ? mapComponents(children) : undefined,
					statusMessage: c.statusMessage?.length ? c.statusMessage : undefined,
				}
			}) ?? undefined
		)
	}

	// Patch the component statusMessage to be from the _internal field if required
	const allComponentsPatched = systemStatus.components?.map((c) => {
		return {
			...c,
			statusMessage: c.statusMessage ?? (c.status !== 'OK' ? c._internal.messages.join(', ') : undefined),
		}
	})

	// Report status for all devices that are not children and any non-devices that are not OK
	const componentStatus =
		mapComponents(
			allComponentsPatched?.filter(
				(c) => (c.instanceId !== undefined || c.status !== 'OK') && c.parentId === undefined
			)
		) ?? []

	const allStatusMessages =
		allComponentsPatched // include children by not using componentStatus here
			?.filter((c) => c.statusMessage !== undefined)
			.map((c) => `${c.name}: ${c.statusMessage}`)
			.join('; ') ?? ''

	const response = ClientAPI.responseSuccess({
		name: systemStatus.name,
		updated: systemStatus.updated,
		status: systemStatus.status,
		version: coreVersion,
		blueprintsVersion: blueprintsVersion,
		components: componentStatus,
		statusMessage: allStatusMessages,
	})

	ctx.body = JSON.stringify({ status: response.success, result: response.result })
	ctx.status = response.success
	await next()
})

registerBlueprintsRoutes(sofieAPIRequest)
registerDevicesRoutes(sofieAPIRequest)
registerPlaylistsRoutes(sofieAPIRequest)
registerShowStylesRoutes(sofieAPIRequest)
registerStudiosRoutes(sofieAPIRequest)
registerSystemRoutes(sofieAPIRequest)
registerBucketsRoutes(sofieAPIRequest)
