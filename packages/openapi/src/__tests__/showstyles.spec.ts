// eslint-disable-next-line node/no-missing-import
import { Configuration, ShowstylesApi } from '../../client/ts'
import Logging from '../httpLogging'

const httpLogging = false
const runTests = process.env.TEST_SERVER

describe('Network client', () => {
	if (runTests) {
		const config = new Configuration({
			basePath: process.env.ACTIONS_URL,
			middleware: httpLogging ? [new Logging()] : [],
		})

		const showStylesApi = new ShowstylesApi(config)
		test('can request all ShowStyleBases', async () => {
			const showStyles = await showStylesApi.getShowStyleBases()
			expect(showStyles.success).toBe(200)
		})

		test('can add a ShowStyleBase', async () => {
			const showStyle = await showStylesApi.addShowStyleBase()
			expect(showStyle.success).toBe(200)
		})

		test('can update a ShowStyleBase', async () => {
			const showStyle = await showStylesApi.addOrUpdateShowStyleBase({
				showStyleBaseId: 'showStyle',
			})
			expect(showStyle.success).toBe(200)
		})

		test('can remove a ShowStyleBase', async () => {
			const showStyle = await showStylesApi.deleteShowStyleBase({
				showStyleBaseId: 'showStyle',
			})
			expect(showStyle.success).toBe(200)
		})
	} else {
		test.todo('Setup mocks for Sofie')
	}
})
