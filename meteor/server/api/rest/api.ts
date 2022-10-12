import Koa from 'koa'
import KoaRouter from 'koa-router'
import BodyParser from 'koa-bodyparser'
import { logger } from '../../logging'
import { WebApp } from 'meteor/webapp'
import { check, Match } from '../../../lib/check'
import { Meteor } from 'meteor/meteor'
import { ClientAPI } from '../../../lib/api/client'
import { getCurrentTime, protectString } from '../../../lib/lib'
import { RestAPI, RestAPIMethods } from '../../../lib/api/rest'
import { registerClassToMeteorMethods, ReplaceOptionalWithNullInMethodArguments } from '../../methods'
import { RundownPlaylists, RundownPlaylistId } from '../../../lib/collections/RundownPlaylists'
import { PartInstanceId } from '../../../lib/collections/PartInstances'
import { MeteorCall, MethodContextAPI } from '../../../lib/api/methods'
import { ServerClientAPI } from '../client'
import { triggerWriteAccess } from '../../security/lib/securityVerify'
import { StudioJobs } from '@sofie-automation/corelib/dist/worker/studio'
import { CURRENT_SYSTEM_VERSION } from '../../migration/currentSystemVersion'

const REST_API_USER_EVENT = 'rest_api'

class ServerRestAPI extends MethodContextAPI implements ReplaceOptionalWithNullInMethodArguments<RestAPI> {
	async index(): Promise<ClientAPI.ClientResponse<{ version: string }>> {
		triggerWriteAccess()

		return ClientAPI.responseSuccess({ version: CURRENT_SYSTEM_VERSION })
	}
	async take(rundownPlaylistId: RundownPlaylistId, fromPartInstanceId: PartInstanceId | null) {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			REST_API_USER_EVENT,
			getCurrentTime(),
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
				check(fromPartInstanceId, Match.OneOf(String, null))
			},
			StudioJobs.TakeNextPart,
			{
				playlistId: rundownPlaylistId,
				fromPartInstanceId,
			}
		)
	}
}
registerClassToMeteorMethods(RestAPIMethods, ServerRestAPI, false)

const koaRouter = new KoaRouter()

koaRouter.get('/', async (ctx, next) => {
	ctx.body = await MeteorCall.rest.index()
	await next()
})

koaRouter.get('/rundownPlaylist/:rundownId', async (ctx, next) => {
	const rundownId = protectString<RundownPlaylistId>(ctx.params.rundownId)
	check(rundownId, String)
	logger.info(`koa GET: rundownPlaylist ${rundownId}`)

	const playlist = await RundownPlaylists.findOneAsync(rundownId)
	if (!playlist) {
		ctx.status = 404
		ctx.body = 'PlaylistID not found'
		return
	}

	try {
		ctx.body = JSON.stringify(playlist, undefined, 2)
		ctx.header['content-disposition'] = `attachment; filename*=UTF-8''${encodeURIComponent(playlist.name)}.json`
		ctx.header['content-type'] = 'application/json'
		ctx.status = 200
	} catch (e) {
		ctx.status = 500
		logger.error('GET rundownPlaylist failed: ' + e)
		ctx.body = e + ''
	}
	await next()
})

koaRouter.post('/take/:rundownId', BodyParser(), async (ctx, next) => {
	const rundownId = protectString<RundownPlaylistId>(ctx.params.rundownId)
	check(rundownId, String)
	logger.info(`koa POST: take ${rundownId}`)
	// console.log('Body:', ctx.request.body)

	try {
		ctx.body = ClientAPI.responseSuccess(await MeteorCall.rest.take(rundownId, null))
		ctx.status = 200
	} catch (e) {
		ctx.status = 500
		logger.error('POST take failed: ' + e)
		ctx.body = e + ''
	}
	await next()
})

Meteor.startup(() => {
	let app = new Koa()
	if (!Meteor.isAppTest) {
		WebApp.connectHandlers.use('/api2', Meteor.bindEnvironment(app.callback()))
	}
	app.use(koaRouter.routes()).use(koaRouter.allowedMethods())
})
