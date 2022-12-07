import { ClientAPI } from '../api/client'
import { MethodContext } from './methods'
import { RundownPlaylistId } from '../collections/RundownPlaylists'
import { AdLibActionId } from '../collections/AdLibActions'
import { RundownBaselineAdLibActionId } from '../collections/RundownBaselineAdLibActions'
import { PartId } from '../collections/Parts'
import { SegmentId } from '../collections/Segments'
import { PieceId } from '../collections/Pieces'
import { BucketAdLibId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'

export interface RestAPI extends MethodContext {
	/**
	 * Returns the current version of Sofie
	 */
	index(): Promise<ClientAPI.ClientResponse<{ version: string }>>
	/**
	 * Activates a Playlist.
	 *
	 * Throws if there is already an active Playlist for the studio that the Playlist belongs to.
	 * @param rundownPlaylistId Playlist to activate.
	 * @param rehearsal Whether to activate into rehearsal mode.
	 */
	activate(rundownPlaylistId: RundownPlaylistId, rehearsal: boolean): Promise<ClientAPI.ClientResponse<void>>
	/**
	 * Deactivates a Playlist.
	 *
	 * Throws if the Playlist is not currently active.
	 * @param rundownPlaylistId Playlist to deactivate.
	 */
	deactivate(rundownPlaylistId: RundownPlaylistId): Promise<ClientAPI.ClientResponse<void>>
	/**
	 * Executes the requested action by passing `actionId` directly to the blueprints `executeAction` function.
	 *
	 * Throws if the target Playlist is not currently active.
	 * Throws if there is not an on-air Part.
	 * Throws if the `executeAction` method of the blueprints throws - blueprint error will be returned to caller.
	 * @returns An object in the form {queuedPartInstanceId?: PartInstanceId, taken?: boolean} (if a part was queued by the action/if the next part was automatically taken)
	 * @param rundownPlaylistId Playlist to execute action in.
	 * @param actionId Action Id string, should match something inside the blueprints.
	 * @param userData Any value, recommended to be a relatively simple { [key: string]: string }-style object, as the object may need to survive a round of serialization.
	 */
	executeAction(
		rundownPlaylistId: RundownPlaylistId,
		actionId: string,
		userData: any
	): Promise<ClientAPI.ClientResponse<object>>
	/**
	 * Executes the requested AdLib/AdLib Action. This is a "planned" AdLib (Action) that has been produced by the blueprints during the ingest process.
	 *
	 * Throws if the target Playlist is not active.
	 * Throws if there is not an on-at part instance.
	 * @returns a `ClientResponseError` if an adLib for the provided `adLibId` cannot be found.
	 * @param rundownPlaylistId Playlist to execute adLib in.
	 * @param adLibId AdLib to execute.
	 * @param triggerMode A string to specify a particular variation for the AdLibAction, valid actionType strings are to be read from the status API.
	 */
	executeAdLib(
		rundownPlaylistId: RundownPlaylistId,
		adLibId: AdLibActionId | RundownBaselineAdLibActionId | PieceId | BucketAdLibId,
		triggerMode?: string
	): Promise<ClientAPI.ClientResponse<object>>
	/**
	 * Moves the next point by `delta` places. Negative values are allowed to move "backwards" in the script.
	 *
	 * Throws if the target Playlist is not active.
	 * Throws if there is not next Part set (e.g. rundown is empty)
	 * If delta results in an index that is greater than the number of Parts available, no action will be taken.
	 * @param rundownPlaylistId Playlist to target.
	 * @param delta Amount to move next point by (+/-)
	 */
	moveNextPart(rundownPlaylistId: RundownPlaylistId, delta: number): Promise<ClientAPI.ClientResponse<PartId | null>>
	/**
	 * Moves the next Segment point by `delta` places. Negative values are allowed to move "backwards" in the script.
	 *
	 * Throws if the target Playlist is not active.
	 * Throws if there is not next Part set (e.g. Playlist is empty)
	 * If delta results in an index that is greater than the number of Segments available, no action will be taken.
	 * @param rundownPlaylistId Playlist to target.
	 * @param delta Amount to move next Segment point by (+/-)
	 */
	moveNextSegment(
		rundownPlaylistId: RundownPlaylistId,
		delta: number
	): Promise<ClientAPI.ClientResponse<PartId | null>>
	/**
	 * Reloads a Playlist from its ingest source (e.g. MOS/Spreadsheet etc.)
	 *
	 * Throws if the target Playlist is currently active.
	 * @returns a `ClientResponseError` if the playlist fails to reload
	 * @param rundownPlaylistId Playlist to reload.
	 */
	reloadPlaylist(rundownPlaylistId: RundownPlaylistId): Promise<ClientAPI.ClientResponse<object>>
	/**
	 * Resets a Playlist back to its pre-played state.
	 *
	 * Throws if the target Playlist is currently active unless reset while on-air is enabled in core settings.
	 * @param rundownPlaylistId Playlist to reset.
	 */
	resetPlaylist(rundownPlaylistId: RundownPlaylistId): Promise<ClientAPI.ClientResponse<void>>
	/**
	 * Sets the next Part to a given PartId.
	 *
	 * Throws if the target playlist is not currently active.
	 * Throws if the specified Part does not exist.
	 * Throws if the specified Part is not playable.
	 * @param rundownPlaylistId Target rundown playlist.
	 * @param partId Part to set as next.
	 */
	setNextPart(rundownPlaylistId: RundownPlaylistId, partId: PartId): Promise<ClientAPI.ClientResponse<void>>
	/**
	 * Sets the next Segment to a given SegmentId.
	 *
	 * Throws if the target Playlist is not currently active.
	 * Throws if the specified Segment does not exist.
	 * Throws if the specified Segment does not contain any playable parts.
	 * @param rundownPlaylistId Target Playlist.
	 * @param segmentId Segment to set as next.
	 */
	setNextSegment(rundownPlaylistId: RundownPlaylistId, segmentId: SegmentId): Promise<ClientAPI.ClientResponse<void>>
	/**
	 * Performs a take in the given Playlist.
	 *
	 * Throws if spcified Playlist is not active.
	 * Throws if specified Playlist does not have a next Part.
	 * @param rundownPlaylistId Target Playlist.
	 */
	take(rundownPlaylistId: RundownPlaylistId): Promise<ClientAPI.ClientResponse<void>>
	/**
	 * Sets a route set to the described state
	 *
	 * Throws if specified studioId does not exist
	 * Throws if specified route set does not exist
	 * Throws if `state` is `false` and the specified route set cannot be deactivated.
	 * @param studioId Studio to target
	 * @param routeSetId Route set within studio
	 * @param state Whether state should be set to active (true) or inactive (false)
	 */
	switchRouteSet(studioId: StudioId, routeSetId: string, state: boolean): Promise<ClientAPI.ClientResponse<void>>
}

export enum RestAPIMethods {
	'index' = 'restAPI.index',
	'activate' = 'restAPI.activate',
	'deactivate' = 'restAPI.deactivate',
	'executeAction' = 'restAPI.executeAction',
	'executeAdLib' = 'restAPI.executeAdLib',
	'moveNextPart' = 'restAPI.moveNextPart',
	'moveNextSegment' = 'restAPI.moveNextSegment',
	'reloadPlaylist' = 'restAPI.reloadPlaylist',
	'resetPlaylist' = 'restAPI.resetPlaylist',
	'setNextPart' = 'restAPI.setNextPart',
	'setNextSegment' = 'restAPI.setNextSegment',
	'take' = 'restAPI.take',
	'switchRouteSet' = 'restAPI.switchRouteSet',
}
