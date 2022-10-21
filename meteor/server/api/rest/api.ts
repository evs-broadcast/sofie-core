import Koa from 'koa'
import KoaRouter from 'koa-router'
import { logger } from '../../logging'
import { WebApp } from 'meteor/webapp'
import { check, Match } from '../../../lib/check'
import { Meteor } from 'meteor/meteor'
import { ClientAPI } from '../../../lib/api/client'
import { getCurrentTime, protectString } from '../../../lib/lib'
import { RestAPI, RestAPIMethods } from '../../../lib/api/rest'
import { registerClassToMeteorMethods, ReplaceOptionalWithNullInMethodArguments } from '../../methods'
import { RundownPlaylists, RundownPlaylistId } from '../../../lib/collections/RundownPlaylists'
import { MeteorCall, MethodContextAPI } from '../../../lib/api/methods'
import { ServerClientAPI } from '../client'
import { triggerWriteAccess } from '../../security/lib/securityVerify'
import { ExecuteActionResult, StudioJobs } from '@sofie-automation/corelib/dist/worker/studio'
import { CURRENT_SYSTEM_VERSION } from '../../migration/currentSystemVersion'
import {
	AdLibActionId,
	BucketAdLibId,
	PartId,
	PieceId,
	RundownBaselineAdLibActionId,
	SegmentId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { AdLibPieces } from '../../../lib/collections/AdLibPieces'
import { AdLibActions } from '../../../lib/collections/AdLibActions'
import { RundownBaselineAdLibPieces } from '../../../lib/collections/RundownBaselineAdLibPieces'
import { RundownBaselineAdLibActions } from '../../../lib/collections/RundownBaselineAdLibActions'
import { BucketAdLibs } from '../../../lib/collections/BucketAdlibs'
import { UserError, UserErrorMessage } from '@sofie-automation/corelib/dist/error'

const REST_API_USER_EVENT = 'rest_api'

class ServerRestAPI extends MethodContextAPI implements ReplaceOptionalWithNullInMethodArguments<RestAPI> {
	async index(): Promise<ClientAPI.ClientResponse<{ version: string }>> {
		triggerWriteAccess()

		return ClientAPI.responseSuccess({ version: CURRENT_SYSTEM_VERSION })
	}
	async activate(rundownPlaylistId: RundownPlaylistId, rehearsal: boolean): Promise<ClientAPI.ClientResponse<void>> {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			REST_API_USER_EVENT,
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
	async deactivate(rundownPlaylistId: RundownPlaylistId): Promise<ClientAPI.ClientResponse<void>> {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			REST_API_USER_EVENT,
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
	async executeAction(
		rundownPlaylistId: RundownPlaylistId,
		actionId: string,
		userData: any
	): Promise<ClientAPI.ClientResponse<ExecuteActionResult>> {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			REST_API_USER_EVENT,
			getCurrentTime(),
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
				check(actionId, String)
			},
			StudioJobs.ExecuteAction,
			{
				playlistId: rundownPlaylistId,
				actionDocId: null,
				actionId,
				userData,
			}
		)
	}
	async executeAdLib(
		rundownPlaylistId: RundownPlaylistId,
		adLibId: AdLibActionId | RundownBaselineAdLibActionId | PieceId | BucketAdLibId
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
			const pieceType = baselineAdLibDoc ? 'baseline' : segmentAdLibDoc ? 'normal' : 'bucket'
			const rundownPlaylist = RundownPlaylists.findOne(rundownPlaylistId, {
				projection: { currentPartInstanceId: 1 },
			})
			if (!rundownPlaylist) throw new Error(`Rundown playlist ${rundownPlaylistId} does not exist`)
			if (rundownPlaylist.currentPartInstanceId === null)
				throw new Error(`No active Part in ${rundownPlaylistId}`)

			const result = await ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
				this,
				REST_API_USER_EVENT,
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
					partInstanceId: rundownPlaylist.currentPartInstanceId,
					pieceType,
				}
			)
			if (ClientAPI.isClientResponseError(result)) return result
			return ClientAPI.responseSuccess({})
		} else if (adLibActionDoc) {
			// This is an AdLib Action
			return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
				this,
				REST_API_USER_EVENT,
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
					userData: adLibActionDoc.userData,
				}
			)
		} else {
			return ClientAPI.responseError(
				UserError.from(new Error(`No adLib with Id ${adLibId}`), UserErrorMessage.AdlibNotFound)
			)
		}
	}
	async moveNextPart(
		rundownPlaylistId: RundownPlaylistId,
		delta: number
	): Promise<ClientAPI.ClientResponse<PartId | null>> {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			REST_API_USER_EVENT,
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
		rundownPlaylistId: RundownPlaylistId,
		delta: number
	): Promise<ClientAPI.ClientResponse<PartId | null>> {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			REST_API_USER_EVENT,
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
	async reloadPlaylist(rundownPlaylistId: RundownPlaylistId): Promise<ClientAPI.ClientResponse<void>> {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			REST_API_USER_EVENT,
			getCurrentTime(),
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
			},
			StudioJobs.RegeneratePlaylist,
			{
				playlistId: rundownPlaylistId,
			}
		)
	}
	async resetPlaylist(rundownPlaylistId: RundownPlaylistId): Promise<ClientAPI.ClientResponse<void>> {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			REST_API_USER_EVENT,
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
		rundownPlaylistId: RundownPlaylistId,
		segmentId: SegmentId
	): Promise<ClientAPI.ClientResponse<void>> {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			REST_API_USER_EVENT,
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
	async setNextPart(rundownPlaylistId: RundownPlaylistId, partId: PartId): Promise<ClientAPI.ClientResponse<void>> {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			REST_API_USER_EVENT,
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
	async take(rundownPlaylistId: RundownPlaylistId): Promise<ClientAPI.ClientResponse<void>> {
		const rundownPlaylist = RundownPlaylists.findOne(rundownPlaylistId)
		if (!rundownPlaylist) throw new Error(`Rundown playlist ${rundownPlaylistId} does not exist`)

		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			REST_API_USER_EVENT,
			getCurrentTime(),
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
			},
			StudioJobs.TakeNextPart,
			{
				playlistId: rundownPlaylistId,
				fromPartInstanceId: rundownPlaylist.currentPartInstanceId,
			}
		)
	}
}
registerClassToMeteorMethods(RestAPIMethods, ServerRestAPI, false)

const koaRouter = new KoaRouter()

koaRouter.get('/', async (ctx, next) => {
	ctx.type = 'application/json'
	ctx.body = ClientAPI.responseSuccess(await MeteorCall.rest.index())
	ctx.status = 200
	await next()
})

koaRouter.post('/activate/:rundownPlaylistId', async (ctx, next) => {
	const rundownPlaylistId = protectString<RundownPlaylistId>(ctx.params.rundownPlaylistId)
	check(rundownPlaylistId, String)
	const rehearsal = (ctx.req.body as { rehearsal: boolean }).rehearsal
	logger.info(`koa POST: activate ${rundownPlaylistId} - ${rehearsal ? 'rehearsal' : 'live'}`)

	try {
		ctx.body = ClientAPI.responseSuccess(await MeteorCall.rest.activate(rundownPlaylistId, rehearsal))
		ctx.status = 200
	} catch (e) {
		const errMsg = UserError.isUserError(e) ? e.message.key : (e as Error).message
		logger.error('POST activate failed - ' + errMsg)
		ctx.type = 'application/json'
		ctx.body = JSON.stringify({ message: errMsg })
		ctx.status = 412
	}
	await next()
})

koaRouter.post('/deactivate/:rundownPlaylistId', async (ctx, next) => {
	const rundownPlaylistId = protectString<RundownPlaylistId>(ctx.params.rundownPlaylistId)
	check(rundownPlaylistId, String)
	logger.info(`koa POST: deactivate ${rundownPlaylistId}`)

	try {
		ctx.body = ClientAPI.responseSuccess(await MeteorCall.rest.deactivate(rundownPlaylistId))
		ctx.status = 200
	} catch (e) {
		const errMsg = UserError.isUserError(e) ? e.message.key : (e as Error).message
		logger.error('POST deactivate failed - ' + errMsg)
		ctx.type = 'application/json'
		ctx.body = JSON.stringify({ message: errMsg })
		ctx.status = 412
	}
	await next()
})

koaRouter.post('/executeAction/:rundownPlaylistId/:actionId', async (ctx, next) => {
	const rundownPlaylistId = protectString<RundownPlaylistId>(ctx.params.rundownPlaylistId)
	check(rundownPlaylistId, String)
	const actionId = ctx.params.actionId
	check(actionId, String)
	const userData = ctx.req.body
	logger.info(`koa POST: executeAction ${rundownPlaylistId} ${actionId} - ${userData}`)

	try {
		ctx.body = ClientAPI.responseSuccess(await MeteorCall.rest.executeAction(rundownPlaylistId, actionId, userData))
		ctx.status = 200
	} catch (e) {
		const errMsg = UserError.isUserError(e) ? e.message.key : (e as Error).message
		logger.error('POST executeAction failed - ' + errMsg)
		ctx.type = 'application/json'
		ctx.body = JSON.stringify({ message: errMsg })
		ctx.status = 412
	}
	await next()
})

koaRouter.post('/executeAdLib/:rundownPlaylistId/:adLibId', async (ctx, next) => {
	const rundownPlaylistId = protectString<RundownPlaylistId>(ctx.params.rundownPlaylistId)
	check(rundownPlaylistId, String)
	const adLibId = protectString<AdLibActionId | RundownBaselineAdLibActionId | PieceId | BucketAdLibId>(
		ctx.params.adLibId
	)
	check(adLibId, String)
	logger.info(`koa POST: executeAdLib ${rundownPlaylistId} ${adLibId}`)

	try {
		ctx.body = ClientAPI.responseSuccess(await MeteorCall.rest.executeAdLib(rundownPlaylistId, adLibId))
		ctx.status = 200
	} catch (e) {
		const errMsg = UserError.isUserError(e) ? e.message.key : (e as Error).message
		logger.error('POST executeAdLib failed - ' + errMsg)
		ctx.type = 'application/json'
		ctx.body = JSON.stringify({ message: errMsg })
		ctx.status = 412
	}
	await next()
})

koaRouter.post('/moveNextPart/:rundownPlaylistId/:delta', async (ctx, next) => {
	const rundownPlaylistId = protectString<RundownPlaylistId>(ctx.params.rundownPlaylistId)
	check(rundownPlaylistId, String)
	const delta = parseInt(ctx.params.delta)
	check(delta, Number)
	logger.info(`koa POST: moveNextPart ${rundownPlaylistId} ${delta}`)

	try {
		ctx.body = ClientAPI.responseSuccess(await MeteorCall.rest.moveNextPart(rundownPlaylistId, delta))
		ctx.status = 200
	} catch (e) {
		const errMsg = UserError.isUserError(e) ? e.message.key : (e as Error).message
		logger.error('POST moveNextPart failed - ' + errMsg)
		ctx.type = 'application/json'
		ctx.body = JSON.stringify({ message: errMsg })
		ctx.status = 412
	}
	await next()
})

koaRouter.post('/moveNextSegment/:rundownPlaylistId/:delta', async (ctx, next) => {
	const rundownPlaylistId = protectString<RundownPlaylistId>(ctx.params.rundownPlaylistId)
	check(rundownPlaylistId, String)
	const delta = parseInt(ctx.params.delta)
	check(delta, Number)
	logger.info(`koa POST: moveNextSegment ${rundownPlaylistId} ${delta}`)

	try {
		ctx.body = ClientAPI.responseSuccess(await MeteorCall.rest.moveNextSegment(rundownPlaylistId, delta))
		ctx.status = 200
	} catch (e) {
		const errMsg = UserError.isUserError(e) ? e.message.key : (e as Error).message
		logger.error('POST moveNextSegment failed - ' + errMsg)
		ctx.type = 'application/json'
		ctx.body = JSON.stringify({ message: errMsg })
		ctx.status = 412
	}
	await next()
})

koaRouter.post('/reloadPlaylist/:rundownPlaylistId', async (ctx, next) => {
	const rundownPlaylistId = protectString<RundownPlaylistId>(ctx.params.rundownPlaylistId)
	check(rundownPlaylistId, String)
	logger.info(`koa POST: reloadPlaylist ${rundownPlaylistId}`)

	try {
		ctx.body = ClientAPI.responseSuccess(await MeteorCall.rest.reloadPlaylist(rundownPlaylistId))
		ctx.status = 200
	} catch (e) {
		const errMsg = UserError.isUserError(e) ? e.message.key : (e as Error).message
		logger.error('POST reloadPlaylist failed - ' + errMsg)
		ctx.type = 'application/json'
		ctx.body = JSON.stringify({ message: errMsg })
		ctx.status = 412
	}
	await next()
})

koaRouter.post('/resetPlaylist/:rundownPlaylistId', async (ctx, next) => {
	const rundownPlaylistId = protectString<RundownPlaylistId>(ctx.params.rundownPlaylistId)
	check(rundownPlaylistId, String)
	logger.info(`koa POST: resetPlaylist ${rundownPlaylistId}`)

	try {
		ctx.body = ClientAPI.responseSuccess(await MeteorCall.rest.resetPlaylist(rundownPlaylistId))
		ctx.status = 200
	} catch (e) {
		const errMsg = UserError.isUserError(e) ? e.message.key : (e as Error).message
		logger.error('POST resetPlaylist failed - ' + errMsg)
		ctx.type = 'application/json'
		ctx.body = JSON.stringify({ message: errMsg })
		ctx.status = 412
	}
	await next()
})

koaRouter.post('/setNextPart/:rundownPlaylistId/:partId', async (ctx, next) => {
	const rundownPlaylistId = protectString<RundownPlaylistId>(ctx.params.rundownPlaylistId)
	check(rundownPlaylistId, String)
	const partId = protectString<PartId>(ctx.params.partId)
	check(partId, String)
	logger.info(`koa POST: setNextPart ${rundownPlaylistId} ${partId}`)

	try {
		ctx.body = ClientAPI.responseSuccess(await MeteorCall.rest.setNextPart(rundownPlaylistId, partId))
		ctx.status = 200
	} catch (e) {
		const errMsg = UserError.isUserError(e) ? e.message.key : (e as Error).message
		logger.error('POST setNextPart failed - ' + errMsg)
		ctx.type = 'application/json'
		ctx.body = JSON.stringify({ message: errMsg })
		ctx.status = 412
	}
	await next()
})

koaRouter.post('/setNextSegment/:rundownPlaylistId/:segmentId', async (ctx, next) => {
	const rundownPlaylistId = protectString<RundownPlaylistId>(ctx.params.rundownPlaylistId)
	check(rundownPlaylistId, String)
	const segmentId = protectString<SegmentId>(ctx.params.segmentId)
	check(segmentId, String)
	logger.info(`koa POST: setNextSegment ${rundownPlaylistId} ${segmentId}`)

	try {
		ctx.body = ClientAPI.responseSuccess(await MeteorCall.rest.setNextSegment(rundownPlaylistId, segmentId))
		ctx.status = 200
	} catch (e) {
		const errMsg = UserError.isUserError(e) ? e.message.key : (e as Error).message
		logger.error('POST setNextSegment failed - ' + errMsg)
		ctx.type = 'application/json'
		ctx.body = JSON.stringify({ message: errMsg })
		ctx.status = 412
	}
	await next()
})

koaRouter.post('/take/:rundownPlaylistId', async (ctx, next) => {
	const rundownPlaylistId = protectString<RundownPlaylistId>(ctx.params.rundownPlaylistId)
	check(rundownPlaylistId, String)
	logger.info(`koa POST: take ${rundownPlaylistId}`)

	try {
		ctx.body = ClientAPI.responseSuccess(await MeteorCall.rest.take(rundownPlaylistId))
		ctx.status = 200
	} catch (e) {
		const errMsg = UserError.isUserError(e) ? e.message.key : (e as Error).message
		logger.error('POST take failed - ' + errMsg)
		ctx.type = 'application/json'
		ctx.body = JSON.stringify({ message: errMsg })
		ctx.status = 412
	}
	await next()
})

Meteor.startup(() => {
	const app = new Koa()
	if (!Meteor.isAppTest) {
		WebApp.connectHandlers.use('/api2', Meteor.bindEnvironment(app.callback()))
	}
	app.use(koaRouter.routes()).use(koaRouter.allowedMethods())
})
