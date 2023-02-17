// eslint-disable-next-line node/no-missing-import
import { Configuration, BlueprintsApi } from '../../client/ts'
import Logging from './httpLogging'

const httpLogging = false
const runTests = process.env.TEST_SERVER

describe('Network client', () => {
	if (runTests) {
		const config = new Configuration({
			basePath: process.env.ACTIONS_URL,
			middleware: httpLogging ? [new Logging()] : [],
		})

		const blueprintsApi = new BlueprintsApi(config)
		test('can request all blueprints available in Sofie', async () => {
			const blueprints = await blueprintsApi.blueprints()
			expect(blueprints.success).toBe(200)
		})

		test('fails to assign a blueprint with null id', async () => {
			await expect(blueprintsApi.blueprint({ blueprintId: null })).rejects.toThrow()
		})

		test('can request information about a blueprint', async () => {
			const blueprint = await blueprintsApi.blueprint({
				blueprintId: 'blueprint',
			})
			expect(blueprint.success).toBe(200)
		})
	} else {
		test.todo('Setup mocks for Sofie')
	}
})
