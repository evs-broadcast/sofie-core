import { Configuration, StudiosApi } from '../../client/ts'
import Logging from '../httpLogging'

const httpLogging = false
const runTests = process.env.TEST_SERVER

describe('Network client', () => {
	if (runTests) {
		const config = new Configuration({
			basePath: process.env.ACTIONS_URL,
			middleware: httpLogging ? [new Logging()] : [],
		})

		const studiosApi = new StudiosApi(config)
		test('can activate a route set in a studio', async () => {
			const routeSet = await studiosApi.switchRouteSet({
				studioId: 'B0avqzSM41UJDpbyf3U28',
				switchRouteSetRequest: { routeSetId: 'Main', active: true },
			})
			expect(routeSet.success).toBe(200)
		})

		test('can deactivate a route set in a studio', async () => {
			const routeSet = await studiosApi.switchRouteSet({
				studioId: 'B0avqzSM41UJDpbyf3U28',
				switchRouteSetRequest: { routeSetId: 'Main', active: false },
			})
			expect(routeSet.success).toBe(200)
		})

		test('can request a list of devices for a studio', async () => {
			const devices = await studiosApi.devices({ studioId: 'B0avqzSM41UJDpbyf3U28' })
			expect(devices.success).toBe(200)
		})

		test('can attach a device to a studio', async () => {
			const attach = await studiosApi.attachDevice({
				studioId: 'B0avqzSM41UJDpbyf3U28',
				attachDeviceRequest: {
					deviceId: 'playoutgateway0',
				},
			})
			expect(attach.success).toBe(200)
		})

		test('can detach a device from a studio', async () => {
			const detach = await studiosApi.detachDevice({
				studioId: 'B0avqzSM41UJDpbyf3U28',
				deviceId: 'playoutgateway0',
			})
			expect(detach.success).toBe(200)
		})
	} else {
		test.todo('Setup mocks for Sofie')
	}
})
