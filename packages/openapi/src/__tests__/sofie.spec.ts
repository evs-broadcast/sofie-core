// eslint-disable-next-line node/no-missing-import
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

		test('fails to assign a system blueprint with null id', async () => {
			await expect(sofieApi.assignSystemBlueprint({ assignSystemBlueprintRequest: null })).rejects.toThrow()
		})

		test('can assign a blueprint for Sofie Core', async () => {
			const sofieVersion = await sofieApi.assignSystemBlueprint({
				assignSystemBlueprintRequest: { blueprintId: 'systemBlueprint' },
			})
			expect(sofieVersion.success).toBe(200)
		})

		test('can unassign a blueprint for Sofie Core', async () => {
			const sofieVersion = await sofieApi.unassignSystemBlueprint()
			expect(sofieVersion.success).toBe(200)
		})
	} else {
		test.todo('Setup mocks for Sofie')
	}
})
