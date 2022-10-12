import { ClientAPI } from '../api/client'
import { MethodContext } from './methods'
import { RundownPlaylistId } from '../collections/RundownPlaylists'
import { PartInstanceId } from '../collections/PartInstances'

export interface RestAPI extends MethodContext {
	index(): Promise<ClientAPI.ClientResponse<{ version: string }>>
	take(
		rundownPlaylistId: RundownPlaylistId,
		fromPartInstanceId: PartInstanceId | null
	): Promise<ClientAPI.ClientResponse<void>>
}

export enum RestAPIMethods {
	'index' = 'restAPI.index',
	'take' = 'restAPI.take',
}