// eslint-disable-next-line node/no-missing-import
import { Middleware, ResponseContext, ErrorContext, RequestContext, FetchParams } from '../client/ts'

class TestError extends Error {
	override name: 'TestError' = 'TestError' as const
	constructor(msg: string) {
		super(msg)
	}
}

export default class Logging implements Middleware {
	_logging: boolean
	constructor(logging?: boolean) {
		this._logging = logging || false
	}

	async pre(context: RequestContext): Promise<void | FetchParams> {
		if (this._logging) console.log(`Request ${context.url} - ${JSON.stringify(context.init).replace(/"/g, '')}`)
	}

	async onError(context: ErrorContext): Promise<void | Response> {
		console.log('Test error:', context.error as string)
		throw new TestError(context.error as string)
	}

	async post(context: ResponseContext): Promise<void | Response> {
		await this._logResponse(context.response)
	}

	async _logResponse(response: Response): Promise<void> {
		if (this._logging) {
			let message: string
			try {
				message = JSON.stringify(await response.json(), null, 2)
			} catch (e) {
				message = 'Response body is not JSON!'
			}
			console.log(`Response ${response.url} ${response.status} ${response.statusText} - ${message}`)
		}
	}
}
