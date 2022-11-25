import { Logger } from 'winston'
import { WebSocket } from 'ws'
import { unprotectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { literal } from '@sofie-automation/shared-lib/dist/lib/lib'
import { WsTopicBase, WsTopic, CollectionObserver } from '../wsHandler'

type PlaylistActivationStatus = 'deactivated' | 'rehearsal' | 'activated'

interface PlaylistStatus {
	id: string
	name: string
	activationStatus: PlaylistActivationStatus
}

interface StudioStatus {
	event: string
	id: string | null
	name: string
	playlists: PlaylistStatus[]
}

export class StudioTopic
	extends WsTopicBase
	implements WsTopic, CollectionObserver<DBStudio>, CollectionObserver<DBRundownPlaylist[]>
{
	_observerName = 'StudioTopic'
	_studio: DBStudio | undefined
	_playlists: DBRundownPlaylist[] | undefined

	constructor(logger: Logger) {
		super('StudioTopic', logger)
	}

	addSubscriber(ws: WebSocket): void {
		super.addSubscriber(ws)
		this.sendStatus(new Set<WebSocket>().add(ws))
	}

	sendStatus(subscribers: Set<WebSocket>): void {
		subscribers.forEach((ws) => {
			if (this._studio) {
				this.sendMessage(
					ws,
					literal<StudioStatus>({
						event: 'studio',
						id: unprotectString(this._studio._id),
						name: this._studio.name,
						playlists: this._playlists
							? this._playlists.map((p) => {
									let activationStatus: PlaylistActivationStatus =
										p.activationId === undefined ? 'deactivated' : 'activated'
									if (p.activationId && p.rehearsal) activationStatus = 'rehearsal'
									return literal<PlaylistStatus>({
										id: unprotectString(p._id),
										name: p.name,
										activationStatus: activationStatus,
									})
							  })
							: [],
					})
				)
			} else {
				this.sendMessage(
					ws,
					literal<StudioStatus>({
						event: 'studio',
						id: null,
						name: 'No Studio',
						playlists: [],
					})
				)
			}
		})
	}

	update(data: DBStudio | DBRundownPlaylist[] | undefined): void {
		if (Array.isArray(data)) {
			this._logger.info(`${this._name} received playlists update`)
			this._playlists = data
		} else {
			this._logger.info(`${this._name} received studio update ${data?._id}`)
			this._studio = data
		}
		this.sendStatus(this._subscribers)
	}
}
