// eslint-disable-next-line node/no-missing-import
import { Configuration, SourceLayersApi } from '../../client/ts'
import Logging from '../httpLogging'

const httpLogging = false
const runTests = process.env.TEST_SERVER

describe('Network client', () => {
	if (runTests) {
		const config = new Configuration({
			basePath: process.env.ACTIONS_URL,
			middleware: httpLogging ? [new Logging()] : [],
		})

		const sourceLayersApi = new SourceLayersApi(config)

		test('fails to clear the target SourceLayer with null playlistId', async () => {
			await expect(
				sourceLayersApi.clearSourceLayer({
					playlistId: null,
					sourceLayerId: '42',
				})
			).rejects.toThrow()
		})

		test('fails to clear the target SourceLayer with null sourceLayerId', async () => {
			await expect(
				sourceLayersApi.clearSourceLayer({
					playlistId: 'OKAgZmZ0Buc99lE_2uPPSKVbMrQ_',
					sourceLayerId: null,
				})
			).rejects.toThrow()
		})

		test('can clear the target SourceLayer', async () => {
			const sofieVersion = await sourceLayersApi.clearSourceLayer({
				playlistId: 'OKAgZmZ0Buc99lE_2uPPSKVbMrQ_',
				sourceLayerId: '42',
			})
			expect(sofieVersion.success).toBe(200)
		})

		test('fails to recall the last sticky Piece with null playlistId', async () => {
			await expect(
				sourceLayersApi.recallSticky({
					playlistId: null,
					sourceLayerId: '42',
				})
			).rejects.toThrow()
		})

		test('fails to recall the last sticky Piece with null sourceLayerId', async () => {
			await expect(
				sourceLayersApi.recallSticky({
					playlistId: 'OKAgZmZ0Buc99lE_2uPPSKVbMrQ_',
					sourceLayerId: null,
				})
			).rejects.toThrow()
		})

		test('can recall the last sticky Piece on the specified SourceLayer', async () => {
			const sofieVersion = await sourceLayersApi.recallSticky({
				playlistId: 'OKAgZmZ0Buc99lE_2uPPSKVbMrQ_',
				sourceLayerId: '42',
			})
			expect(sofieVersion.success).toBe(200)
		})
	} else {
		test.todo('Setup mocks for Sofie')
	}
})
