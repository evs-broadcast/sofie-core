import { registerClassToMeteorMethods } from '../methods'
import { StatusResponse, NewSystemStatusAPI, SystemStatusAPIMethods } from '../../lib/api/systemStatus'
import { getDebugStates, getSystemStatus } from './systemStatus'
import { protectString } from '../../lib/lib'
import { Settings } from '../../lib/Settings'
import { MethodContextAPI } from '../../lib/api/methods'
import { profiler } from '../api/profiler'
import { PeripheralDeviceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PrometheusHTTPContentType, getPrometheusMetricsString } from '@sofie-automation/corelib/dist/prometheus'
import { collectWorkerPrometheusMetrics } from '../worker/worker'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import { Meteor } from 'meteor/meteor'
import { bindKoaRouter } from '../api/rest/koa'

const apmNamespace = 'http'

export const metricsRouter = new KoaRouter()
export const healthRouter = new KoaRouter()

if (!Settings.enableUserAccounts) {
	// For backwards compatibility:

	metricsRouter.get('/', async (ctx) => {
		const transaction = profiler.startTransaction('metrics', apmNamespace)
		try {
			ctx.response.type = PrometheusHTTPContentType

			const [meteorMetrics, workerMetrics] = await Promise.all([
				getPrometheusMetricsString(),
				collectWorkerPrometheusMetrics(),
			])

			ctx.body = [meteorMetrics, ...workerMetrics].join('\n\n')
		} catch (ex) {
			ctx.response.status = 500
			ctx.body = ex + ''
		}
		transaction?.end()
	})

	healthRouter.get('/', async (ctx) => {
		const transaction = profiler.startTransaction('health', apmNamespace)
		const status = await getSystemStatus({ userId: null })
		health(status, ctx)
		transaction?.end()
	})

	healthRouter.get('/:studioId', async (ctx) => {
		const transaction = profiler.startTransaction('health', apmNamespace)
		const status = await getSystemStatus({ userId: null }, protectString(ctx.params.studioId))
		health(status, ctx)
		transaction?.end()
	})
}
healthRouter.get('/:token', async (ctx) => {
	const transaction = profiler.startTransaction('health', apmNamespace)
	const status = await getSystemStatus({ userId: null, token: ctx.params.token })
	health(status, ctx)
	transaction?.end()
})
healthRouter.get('/:token/:studioId', async (ctx) => {
	const transaction = profiler.startTransaction('health', apmNamespace)
	const status = await getSystemStatus({ userId: null, token: ctx.params.token }, protectString(ctx.params.studioId))
	health(status, ctx)
	transaction?.end()
})
function health(status: StatusResponse, ctx: Koa.ParameterizedContext) {
	ctx.response.type = 'application/json'

	ctx.response.status = status.status === 'OK' || status.status === 'WARNING' ? 200 : 500

	ctx.body = JSON.stringify(status)
}

class ServerSystemStatusAPI extends MethodContextAPI implements NewSystemStatusAPI {
	async getSystemStatus() {
		return getSystemStatus(this)
	}

	async getDebugStates(peripheralDeviceId: PeripheralDeviceId) {
		return getDebugStates(this, peripheralDeviceId)
	}
}
registerClassToMeteorMethods(SystemStatusAPIMethods, ServerSystemStatusAPI, false)

Meteor.startup(() => {
	bindKoaRouter(metricsRouter, '/metrics')
	bindKoaRouter(healthRouter, '/health')
})
