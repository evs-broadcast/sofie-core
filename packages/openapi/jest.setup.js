module.exports = async function () {
	// Set expected server to be Sofie if SERVER_TYPE is not defined
	if (!process.env.SERVER_TYPE) {
		process.env.SERVER_TYPE = 'SOFIE'
	}

	const defaultPort = !isNaN(process.env.SERVER_PORT) ? Number(process.env.SERVER_PORT) : 3000

	if (!process.env.SERVER_URL) {
		process.env.SERVER_URL = `http://localhost:${defaultPort}/api/v1.0`
	}
}
