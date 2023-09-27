/**
 * This file spins up a mock of the Sofie API and runs tests against it to verify that the generated Client and Server
 * 	speak the same language. The tests in this package must be run against either a mock or a real Sofie server, so this
 *  file should be used when running against a mock is desired.
 */

import { exec } from 'child_process'
import { exit } from 'process'
import { join } from 'path'
import { createServer } from 'http'
import { expressAppConfig } from './server/node_modules/oas3-tools/dist/index.js'

const testTimeout = 120000

async function startServer() {
	const options = { routing: { controllers: join('server', 'controllers') } }
	const appConfig = expressAppConfig(join('server', 'api', 'openapi.yaml'), options)
	const app = appConfig.getApp()

	const server = createServer(app)
	return new Promise((resolve, reject) => {
		server.listen(() => {
			console.log(`\nTest server is listening on port ${server.address().port}`)
			resolve(server)
		})

		let numRetries = 0
		server.on('error', (e) => {
			if (e.code === 'EADDRINUSE') {
				if (numRetries < 5) {
					console.log('Address in use, retrying...')
					server.close()
					setTimeout(() => {
						server.listen(function () {
							console.log(`\nTest server is listening on port ${server.address().port}`)
							resolve(server)
						})
					}, 1000)
				} else {
					reject(new Error(`Failed to connect - server did not start`))
				}
				numRetries++
			} else reject(e)
		})
	})
}

startServer()
	.then((testServer) => {
		setTimeout(() => {
			console.log('Tests took too long...')
			testServer.close()
			exit(1)
		}, testTimeout)

		console.log('\nRunning tests against test server.')
		exec(
			'yarn unit:no-server',
			{
				timeout: testTimeout,
				env: {
					...process.env,
					SERVER_TYPE: 'TEST',
					SERVER_PORT: `${testServer.address().port}`,
				},
			},
			(error, stdout, stderr) => {
				console.log(stdout)
				console.log('Warning:', stderr)
				testServer.close()
				console.log('Tests complete')
				exit()
			}
		)
	})
	.catch((err) => {
		console.error(err)
		exit(1)
	})
