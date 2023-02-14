import { ClientAPI } from '../api/client'
import {
	AdLibActionId,
	BucketAdLibId,
	PartId,
	PartInstanceId,
	PeripheralDeviceId,
	PieceId,
	RundownBaselineAdLibActionId,
	RundownPlaylistId,
	SegmentId,
	StudioId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { Meteor } from 'meteor/meteor'
import { PeripheralDevice, PeripheralDeviceType } from '../collections/PeripheralDevices'
import { assertNever, unprotectString } from '../lib'
import { StatusCode } from '@sofie-automation/blueprints-integration'

export interface RestAPI {
	/**
	 * Returns the current version of Sofie
	 */
	index(): Promise<ClientAPI.ClientResponse<{ version: string }>>
	/**
	 * Activates a Playlist.
	 *
	 * Throws if there is already an active Playlist for the studio that the Playlist belongs to.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param rundownPlaylistId Playlist to activate.
	 * @param rehearsal Whether to activate into rehearsal mode.
	 */
	activate(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId,
		rehearsal: boolean
	): Promise<ClientAPI.ClientResponse<void>>
	/**
	 * Deactivates a Playlist.
	 *
	 * Throws if the Playlist is not currently active.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param rundownPlaylistId Playlist to deactivate.
	 */
	deactivate(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId
	): Promise<ClientAPI.ClientResponse<void>>
	/**
	 * Executes the requested AdLib/AdLib Action. This is a "planned" AdLib (Action) that has been produced by the blueprints during the ingest process.
	 *
	 * Throws if the target Playlist is not active.
	 * Throws if there is not an on-at part instance.
	 * @returns a `ClientResponseError` if an adLib for the provided `adLibId` cannot be found.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param rundownPlaylistId Playlist to execute adLib in.
	 * @param adLibId AdLib to execute.
	 * @param triggerMode A string to specify a particular variation for the AdLibAction, valid actionType strings are to be read from the status API.
	 */
	executeAdLib(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId,
		adLibId: AdLibActionId | RundownBaselineAdLibActionId | PieceId | BucketAdLibId,
		triggerMode?: string
	): Promise<ClientAPI.ClientResponse<object>>
	/**
	 * Moves the next point by `delta` places. Negative values are allowed to move "backwards" in the script.
	 *
	 * Throws if the target Playlist is not active.
	 * Throws if no next Part could be set (e.g. Playlist is empty, delta is too high and overflows the bounds of the Playlist)
	 * If delta results in an index that is greater than the number of Parts available, no action will be taken.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param rundownPlaylistId Playlist to target.
	 * @param delta Amount to move next point by (+/-)
	 */
	moveNextPart(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId,
		delta: number
	): Promise<ClientAPI.ClientResponse<PartId | null>>
	/**
	 * Moves the next Segment point by `delta` places. Negative values are allowed to move "backwards" in the script.
	 *
	 * Throws if the target Playlist is not active.
	 * Throws if there is not next Part set (e.g. Playlist is empty)
	 * If delta results in an index that is greater than the number of Segments available, no action will be taken.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param rundownPlaylistId Playlist to target.
	 * @param delta Amount to move next Segment point by (+/-)
	 */
	moveNextSegment(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId,
		delta: number
	): Promise<ClientAPI.ClientResponse<PartId | null>>
	/**
	 * Reloads a Playlist from its ingest source (e.g. MOS/Spreadsheet etc.)
	 *
	 * Throws if the target Playlist is currently active.
	 * @returns a `ClientResponseError` if the playlist fails to reload
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param rundownPlaylistId Playlist to reload.
	 */
	reloadPlaylist(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId
	): Promise<ClientAPI.ClientResponse<object>>
	/**
	 * Resets a Playlist back to its pre-played state.
	 *
	 * Throws if the target Playlist is currently active unless reset while on-air is enabled in core settings.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param rundownPlaylistId Playlist to reset.
	 */
	resetPlaylist(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId
	): Promise<ClientAPI.ClientResponse<void>>
	/**
	 * Sets the next Part to a given PartId.
	 *
	 * Throws if the target playlist is not currently active.
	 * Throws if the specified Part does not exist.
	 * Throws if the specified Part is not playable.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param rundownPlaylistId Target rundown playlist.
	 * @param partId Part to set as next.
	 */
	setNextPart(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId,
		partId: PartId
	): Promise<ClientAPI.ClientResponse<void>>
	/**
	 * Sets the next Segment to a given SegmentId.
	 *
	 * Throws if the target Playlist is not currently active.
	 * Throws if the specified Segment does not exist.
	 * Throws if the specified Segment does not contain any playable parts.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param rundownPlaylistId Target Playlist.
	 * @param segmentId Segment to set as next.
	 */
	setNextSegment(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId,
		segmentId: SegmentId
	): Promise<ClientAPI.ClientResponse<void>>
	/**
	 * Performs a take in the given Playlist.
	 *
	 * Throws if spcified Playlist is not active.
	 * Throws if specified Playlist does not have a next Part.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param rundownPlaylistId Target Playlist.
	 * @param fromPartInstanceId Part instance this take is for, used as a safety guard against performing multiple takes when only one was intended.
	 */
	take(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId,
		fromPartInstanceId: PartInstanceId | undefined
	): Promise<ClientAPI.ClientResponse<void>>
	/**
	 * Sets a route set to the described state
	 *
	 * Throws if specified studioId does not exist
	 * Throws if specified route set does not exist
	 * Throws if `state` is `false` and the specified route set cannot be deactivated.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param studioId Studio to target
	 * @param routeSetId Route set within studio
	 * @param state Whether state should be set to active (true) or inactive (false)
	 */
	switchRouteSet(
		connection: Meteor.Connection,
		event: string,
		studioId: StudioId,
		routeSetId: string,
		state: boolean
	): Promise<ClientAPI.ClientResponse<void>>
	/**
	 * Clears the specified SourceLayer.
	 *
	 * Throws if specified playlist is not active.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param rundownPlaylistId Target Playlist.
	 * @param sourceLayerId Target SourceLayer.
	 */
	clearSourceLayer(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId,
		sourceLayerId: string
	): Promise<ClientAPI.ClientResponse<void>>
	/**
	 * Recalls the last sticky Piece on the specified SourceLayer, if there is any.
	 *
	 * Throws if specified playlist is not active.
	 * Throws if specified SourceLayer is not sticky.
	 * Throws if there is no sticky piece for this SourceLayer.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param rundownPlaylistId Target Playlist.
	 * @param sourceLayerId Target SourceLayer.
	 */
	recallStickyPiece(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId,
		sourceLayerId: string
	): Promise<ClientAPI.ClientResponse<void>>
	/**
	 * Gets all devices attached to Sofie.
	 *
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 */
	getPeripheralDevices(connection: Meteor.Connection, event: string): Promise<ClientAPI.ClientResponse<Array<string>>>
	/**
	 * Get a specific device.
	 *
	 * Throws if the requested device does not exist.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param deviceId Device to get
	 */
	getPeripheralDevice(
		connection: Meteor.Connection,
		event: string,
		deviceId: PeripheralDeviceId
	): Promise<ClientAPI.ClientResponse<APIPeripheralDevice>>
	/**
	 * Send an action to a device.
	 *
	 * Throws if the requested device does not exits.
	 * Throws if the action is not valid for the requested device.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param deviceId Device to target
	 * @param action Action to perform
	 */
	peripheralDeviceAction(
		connection: Meteor.Connection,
		event: string,
		deviceId: PeripheralDeviceId,
		action: PeripheralDeviceAction
	): Promise<ClientAPI.ClientResponse<void>>
	/**
	 * Fetches all of the peripheral devices attached to a studio.
	 *
	 * Throws if the requested Studio does not exist.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param studioId Studio to fetch devices for
	 */
	getPeripheralDevicesForStudio(
		connection: Meteor.Connection,
		event: string,
		studioId: StudioId
	): Promise<ClientAPI.ClientResponse<Array<string>>>
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

// This interface should be auto-generated in future
export interface APIPeripheralDevice {
	id: string
	name: string
	status: 'unknown' | 'good' | 'warning_major' | 'marning_minor' | 'bad' | 'fatal'
	messages: string[]
	deviceType:
		| 'unknown'
		| 'mos'
		| 'spreadsheet'
		| 'inews'
		| 'playout'
		| 'media_manager'
		| 'package_manager'
		| 'live_status'
	connected: boolean
}

export function APIPeripheralDeviceFrom(device: PeripheralDevice): APIPeripheralDevice {
	let status: APIPeripheralDevice['status'] = 'unknown'
	switch (device.status.statusCode) {
		case StatusCode.BAD:
			status = 'bad'
			break
		case StatusCode.FATAL:
			status = 'fatal'
			break
		case StatusCode.GOOD:
			status = 'good'
			break
		case StatusCode.WARNING_MAJOR:
			status = 'warning_major'
			break
		case StatusCode.WARNING_MINOR:
			status = 'marning_minor'
			break
		case StatusCode.UNKNOWN:
			status = 'unknown'
			break
		default:
			assertNever(device.status.statusCode)
	}

	let deviceType: APIPeripheralDevice['deviceType'] = 'unknown'
	switch (device.type) {
		case PeripheralDeviceType.INEWS:
			deviceType = 'inews'
			break
		case PeripheralDeviceType.LIVE_STATUS:
			deviceType = 'live_status'
			break
		case PeripheralDeviceType.MEDIA_MANAGER:
			deviceType = 'media_manager'
			break
		case PeripheralDeviceType.MOS:
			deviceType = 'mos'
			break
		case PeripheralDeviceType.PACKAGE_MANAGER:
			deviceType = 'package_manager'
			break
		case PeripheralDeviceType.PLAYOUT:
			deviceType = 'playout'
			break
		case PeripheralDeviceType.SPREADSHEET:
			deviceType = 'spreadsheet'
			break
		default:
			assertNever(device.type)
	}

	return {
		id: unprotectString(device._id),
		name: device.name,
		status,
		messages: device.status.messages ?? [],
		deviceType,
		connected: device.connected,
	}
}

export enum PeripheralDeviceActionType {
	RESTART = 'restart',
}

export interface PeripheralDeviceActionBase {
	type: PeripheralDeviceActionType
}

export interface PeripheralDeviceActionRestart extends PeripheralDeviceActionBase {
	type: PeripheralDeviceActionType.RESTART
}

export type PeripheralDeviceAction = PeripheralDeviceActionRestart
