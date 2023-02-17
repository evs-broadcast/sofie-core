// eslint-disable-next-line node/no-missing-import
import { Configuration, DevicesApi } from '../../client/ts'
import Logging from './httpLogging'

const httpLogging = false
const runTests = process.env.TEST_SERVER

describe('Network client', () => {
	if (runTests) {
		const config = new Configuration({
			basePath: process.env.ACTIONS_URL,
			middleware: httpLogging ? [new Logging()] : [],
		})

		const devicesApi = new DevicesApi(config)
		test('can request all peripheral devices attached to Sofie', async () => {
			const devices = await devicesApi.devices()
			expect(devices.success).toBe(200)
		})

		test('can request details of a specified peripheral device attached to Sofie', async () => {
			const device = await devicesApi.device({ deviceId: 'playoutgateway0' })
			expect(device.success).toBe(200)
		})

		test('can send a command to a specified peripheral device', async () => {
			const action = await devicesApi.action({
				deviceId: 'playoutgateway0',
				actionRequest: { action: 'restart' },
			})
			expect(action.success).toBe(202)
		})
	} else {
		test.todo('Setup mocks for Sofie')
	}
})
