import {
	Configuration,
	SofieApi,
	PlaylistsApi,
	Middleware,
	ResponseContext,
	ErrorContext,
	RequestContext,
	FetchParams,
} from '../../client/ts'

const httpLogging = false
const runTests = false

class TestError extends Error {
	override name: 'TestError' = 'TestError' as const
	constructor(msg: string) {
		super(msg)
	}
}

class Logging implements Middleware {
	async pre(context: RequestContext): Promise<void | FetchParams> {
		console.log(`Request ${context.url} - ${JSON.stringify(context.init).replace(/"/g, '')}`)
	}

	async onError(context: ErrorContext): Promise<void | Response> {
		throw new TestError(context.error as string)
	}

	async post(context: ResponseContext): Promise<void | Response> {
		await this._logResponse(context.response)
	}

	async _logResponse(response: Response) {
		let message: string
		try {
			message = JSON.stringify(await response.json(), null, 2)
		} catch (e) {
			message = `response body not json`
		}
		console.log(`Response ${response.url} ${response.status} ${response.statusText} - ${message}`)
	}
}

describe('Network client', () => {
	if (runTests) {
		const config = new Configuration({
			basePath: 'http://127.0.0.1:3000/api2',
			middleware: httpLogging ? [new Logging()] : [],
		})

		const sofieApi = new SofieApi(config)
		test('can request current version of Sofie application', async () => {
			const sofieVersion = await sofieApi.index()
			expect(sofieVersion.success).toBe(200)
			expect(sofieVersion.result.version).toBe('1.44.0')
		})

		const playlistsApi = new PlaylistsApi(config)
		test('can activate a playlist', async () => {
			const active = await playlistsApi.activate({
				playlistId: 'OKAgZmZ0Buc99lE_2uPPSKVbMrQ_',
				activateRequest: { rehearsal: true },
			})
			expect(active.success).toBe(200)
		})

		test('can set next part in a playlist', async () => {
			const setNext = await playlistsApi.setNextPart({
				playlistId: 'OKAgZmZ0Buc99lE_2uPPSKVbMrQ_',
				setNextPartRequest: { partId: '9Qk3eNHtqwBRGxsGqQiVCxJsYwE_' },
			})
			expect(setNext.success).toBe(200)
		})

		test('can set next segment in a playlist', async () => {
			const setNext = await playlistsApi.setNextSegment({
				playlistId: 'OKAgZmZ0Buc99lE_2uPPSKVbMrQ_',
				setNextSegmentRequest: { segmentId: 'cIt0kEWuHOvQVMDEKzCrBpgGWSs_' },
			})
			expect(setNext.success).toBe(200)
		})

		test('can move next part in a playlist', async () => {
			const move = await playlistsApi.moveNextPart({
				playlistId: 'OKAgZmZ0Buc99lE_2uPPSKVbMrQ_',
				moveNextPartRequest: { delta: 2 },
			})
			expect(move.success).toBe(200)
			expect(move.result).toBe('3Y9at66pZipxE8Kkn850LLV9Cz0_')
		})

		test('can move next segment in a playlist', async () => {
			const move = await playlistsApi.moveNextSegment({
				playlistId: 'OKAgZmZ0Buc99lE_2uPPSKVbMrQ_',
				moveNextSegmentRequest: { delta: 2 },
			})
			expect(move.success).toBe(200)
			expect(move.result).toBe('YjGd_1dWjta_E1ZuDaOczP1lsgk_')
		})

		test('can send take action to the Sofie application', async () => {
			const take = await playlistsApi.take({ playlistId: 'OKAgZmZ0Buc99lE_2uPPSKVbMrQ_' })
			expect(take.success).toBe(200)
		})

		test('can execute an adLib', async () => {
			const execute = await playlistsApi.executeAdLib({
				playlistId: 'OKAgZmZ0Buc99lE_2uPPSKVbMrQ_',
				executeAdLibRequest: { adLibId: 'JustDoIt' },
			})
			expect(execute.success).toBe(200)
		})

		test('can deactivate a playlist', async () => {
			const deactive = await playlistsApi.deactivate({ playlistId: 'OKAgZmZ0Buc99lE_2uPPSKVbMrQ_' })
			expect(deactive.success).toBe(200)
		})

		test('can reset a playlist', async () => {
			const reset = await playlistsApi.resetPlaylist({ playlistId: 'OKAgZmZ0Buc99lE_2uPPSKVbMrQ_' })
			expect(reset.success).toBe(200)
		})

		test('can reload a playlist', async () => {
			const reload = await playlistsApi.reloadPlaylist({ playlistId: 'OKAgZmZ0Buc99lE_2uPPSKVbMrQ_' })
			expect(reload.success).toBe(200)
		})
	} else {
		test.todo('Setup mocks for Sofie')
	}
})
