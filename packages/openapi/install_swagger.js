const util = require('util')
const fs = require('fs')
// eslint-disable-next-line node/no-unpublished-require
const wget = require('wget-improved')
const [mkdir, access] = [fs.mkdir, fs.access].map(util.promisify)

async function get(url, path) {
	let totalBytes = 0
	let lastProgress = 0
	return new Promise((resolve, reject) => {
		const download = wget.download(url, path)
		download.on('error', function (err) {
			console.log('Error while downloading:', err)
			reject(err)
		})
		download.on('start', function (fileSize) {
			totalBytes = fileSize
		})
		download.on('progress', function (progress) {
			const curProgress = (progress * 100).toFixed(0)
			if (curProgress - lastProgress >= 10) {
				process.stdout.write(`Downloaded ${curProgress}% of '${path}'.\r`)
				lastProgress = curProgress
			}
		})
		download.on('end', function (output) {
			process.stdout.write(`Downloaded 100% of '${path}'. Total length ${totalBytes} bytes.\n`)
			resolve(output)
		})
	})
}

async function checkInstall() {
	console.log('Checking/Installing swagger codegen.')
	await mkdir('jars').catch((e) => {
		if (e.code === 'EEXIST') return
		else throw e
	})

	const srcPath =
		'https://repo1.maven.org/maven2/io/swagger/codegen/v3/swagger-codegen-cli/3.0.34/swagger-codegen-cli-3.0.34.jar'
	const swaggerFilename = 'swagger-codegen-cli.jar'
	await access(`jars/${swaggerFilename}`, fs.constants.R_OK).catch(async () =>
		get(srcPath, `jars/${swaggerFilename}`)
	)
}

checkInstall()
