import { Logger } from 'winston'
import { CoreHandler } from './coreHandler'
import { WebSocket, WebSocketServer } from 'ws'
import { RootHandler } from './channels/root'
import { StudioHandler } from './channels/studio'
import { PlaylistHandler } from './channels/playlist'
import { RundownHandler } from './channels/rundown'
import { SegmentHandler } from './channels/segment'
import { PartHandler } from './channels/part'
import { PartInstancesHandler } from './channels/partInstances'

export enum StatusChannels {
	studio = 'studio',
	playlist = 'playlist',
	rundown = 'rundown',
	segment = 'segment',
	part = 'part',
}

export class LiveStatusServer {
	_logger: Logger
	_coreHandler: CoreHandler
	_clients: Set<WebSocket> = new Set()

	constructor(logger: Logger, coreHandler: CoreHandler) {
		this._logger = logger
		this._coreHandler = coreHandler
	}

	async init(): Promise<void> {
		this._logger.info('Initializing WebSocket server...')

		const rootHandler = new RootHandler(this._logger, this._coreHandler)
		const studioHandler = new StudioHandler(this._logger, this._coreHandler)
		const playlistHandler = new PlaylistHandler(this._logger, this._coreHandler)
		const rundownHandler = new RundownHandler(this._logger, this._coreHandler)
		const segmentHandler = new SegmentHandler(this._logger, this._coreHandler)
		const partHandler = new PartHandler(this._logger, this._coreHandler)
		const partInstancesHandler = new PartInstancesHandler(this._logger, this._coreHandler)

		await rootHandler.init()
		await rootHandler.addHandler('studio', studioHandler)
		await rootHandler.addHandler('playlist', playlistHandler)
		await rootHandler.addHandler('rundown', rundownHandler)
		await rootHandler.addHandler('segment', segmentHandler)
		await rootHandler.addHandler('part', partHandler)
		await rootHandler.addHandler('partInstances', partInstancesHandler)

		playlistHandler.playlistsHandler.subscribe(studioHandler)
		playlistHandler.subscribe(rundownHandler)
		playlistHandler.subscribe(partHandler)
		playlistHandler.subscribe(partInstancesHandler)
		partInstancesHandler.subscribe(playlistHandler)
		partInstancesHandler.subscribe(rundownHandler)
		partInstancesHandler.subscribe(segmentHandler)
		partInstancesHandler.subscribe(partHandler)

		const wss = new WebSocketServer({ port: 8080 })
		wss.on('connection', (ws, request) => {
			this._logger.info(`WebSocket connection requested for path '${request.url}'`)

			ws.on('close', () => {
				this._logger.info(`Closing websocket`)
				rootHandler.removeSubscriber(ws)
				this._clients.delete(ws)
			})
			this._clients.add(ws)

			if (typeof request.url === 'string' && request.url === '/') {
				rootHandler.addSubscriber(ws)
			} else {
				this._logger.error(`WebSocket connection request for unsupported path '${request.url}'`)
			}
		})
		wss.on('close', () => {
			this._logger.info(`WebSocket connection closed`)
			rootHandler.close()
		})
		wss.on('error', (err) => this._logger.error(err.message))

		this._logger.info('WebSocket server initialized')
	}
}
