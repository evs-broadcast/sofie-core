import { Configuration, SofieApi } from '../../client/ts'
import Logging from '../httpLogging'

const httpLogging = false
const runTests = process.env.TEST_SERVER

describe('Network client', () => {
	if (runTests) {
		const config = new Configuration({
			basePath: process.env.ACTIONS_URL,
			middleware: httpLogging ? [new Logging()] : [],
		})

		const sofieApi = new SofieApi(config)
		test('can request current version of Sofie application', async () => {
			const sofieVersion = await sofieApi.index()
			expect(sofieVersion.success).toBe(200)
			expect(sofieVersion.result.version).toBe('1.44.0')
		})
	} else {
		test.todo('Setup mocks for Sofie')
	}
})
