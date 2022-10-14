import {
	Configuration,
	UserActionsApi,
	Middleware,
	ResponseContext,
	ErrorContext,
	RequestContext,
	FetchParams,
} from '../../client/ts'

class TestError extends Error {
	override name: 'TestError' = 'TestError'
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
		let message = 'Unknown error'
		try {
			message = JSON.stringify(await response.json(), null, 2)
		} catch (e) {
			message = 'response body not json: ' + response.text()
		}
		console.log(`Response ${response.status} ${response.statusText} - ${message}`)
	}
}

describe('Network client', () => {
	const config = new Configuration({ basePath: 'http://127.0.0.1:3000/api2', middleware: [new Logging()] })
	const actionsApi = new UserActionsApi(config)

	test('can send take action to the Sofie application', async () => {
		await expect(actionsApi.take({ playlistId: 'OKAgZmZ0Buc99lE_2uPPSKVbMrQ_' })).resolves.toBeTruthy()
	})
})
