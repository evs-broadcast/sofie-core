import {
	ExpectedPackageId,
	PeripheralDeviceId,
	RundownId,
	RundownPlaylistActivationId,
	RundownPlaylistId,
	ShowStyleBaseId,
	StudioId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBTimelineDatastoreEntry } from '@sofie-automation/corelib/dist/dataModel/TimelineDatastore'
import { Meteor } from 'meteor/meteor'
import { AdLibAction } from '../collections/AdLibActions'
import { AdLibPiece } from '../collections/AdLibPieces'
import { Blueprint } from '../collections/Blueprints'
import { BucketAdLibAction } from '../collections/BucketAdlibActions'
import { BucketAdLib } from '../collections/BucketAdlibs'
import { Bucket } from '../collections/Buckets'
import { ICoreSystem } from '../collections/CoreSystem'
import { Evaluation } from '../collections/Evaluations'
import { ExpectedMediaItem } from '../collections/ExpectedMediaItems'
import { ExpectedPackageDB } from '../collections/ExpectedPackages'
import { ExpectedPackageWorkStatus } from '../collections/ExpectedPackageWorkStatuses'
import { ExpectedPlayoutItem } from '../collections/ExpectedPlayoutItems'
import { ExternalMessageQueueObj } from '../collections/ExternalMessageQueue'
import { IngestDataCacheObj } from '../collections/IngestDataCache'
import { MediaObject } from '../collections/MediaObjects'
import { MediaWorkFlow } from '../collections/MediaWorkFlows'
import { MediaWorkFlowStep } from '../collections/MediaWorkFlowSteps'
import { DBOrganization } from '../collections/Organization'
import { PackageContainerPackageStatusDB } from '../collections/PackageContainerPackageStatus'
import { PackageContainerStatusDB } from '../collections/PackageContainerStatus'
import { PackageInfoDB } from '../collections/PackageInfos'
import { PartInstance } from '../collections/PartInstances'
import { DBPart } from '../collections/Parts'
import { PeripheralDeviceCommand } from '../collections/PeripheralDeviceCommands'
import { PeripheralDevice } from '../collections/PeripheralDevices'
import { PieceInstance } from '../collections/PieceInstances'
import { Piece } from '../collections/Pieces'
import { RundownBaselineAdLibAction } from '../collections/RundownBaselineAdLibActions'
import { RundownBaselineAdLibItem } from '../collections/RundownBaselineAdLibPieces'
import { RundownLayoutBase } from '../collections/RundownLayouts'
import { DBRundownPlaylist } from '../collections/RundownPlaylists'
import { DBRundown } from '../collections/Rundowns'
import { DBSegment } from '../collections/Segments'
import { DBShowStyleBase } from '../collections/ShowStyleBases'
import { DBShowStyleVariant } from '../collections/ShowStyleVariants'
import { SnapshotItem } from '../collections/Snapshots'
import { DBStudio, RoutedMappings } from '../collections/Studios'
import { RoutedTimeline, TimelineComplete } from '../collections/Timeline'
import { TranslationsBundle } from '../collections/TranslationsBundles'
import { DBTriggeredActions, UITriggeredActionsObj } from '../collections/TriggeredActions'
import { UserActionsLogItem } from '../collections/UserActionsLog'
import { DBUser } from '../collections/Users'
import { DBObj } from '../lib'
import { MongoQuery } from '../typings/meteor'
import { UIPieceContentStatus, UISegmentPartNote } from './rundownNotifications'
import { UIShowStyleBase } from './showStyles'
import { UIStudio } from './studios'

/**
 * Ids of possible DDP subscriptions
 */
export enum PubSub {
	blueprints = 'blueprints',
	coreSystem = 'coreSystem',
	evaluations = 'evaluations',
	expectedPlayoutItems = 'expectedPlayoutItems',
	expectedMediaItems = 'expectedMediaItems',
	externalMessageQueue = 'externalMessageQueue',
	mediaObjects = 'mediaObjects',
	peripheralDeviceCommands = 'peripheralDeviceCommands',
	peripheralDevices = 'peripheralDevices',
	peripheralDevicesAndSubDevices = ' peripheralDevicesAndSubDevices',
	rundownBaselineAdLibPieces = 'rundownBaselineAdLibPieces',
	rundownBaselineAdLibActions = 'rundownBaselineAdLibActions',
	ingestDataCache = 'ingestDataCache',
	rundownPlaylists = 'rundownPlaylists',
	rundowns = 'rundowns',
	adLibActions = 'adLibActions',
	adLibPieces = 'adLibPieces',
	pieces = 'pieces',
	pieceInstances = 'pieceInstances',
	pieceInstancesSimple = 'pieceInstancesSimple',
	parts = 'parts',
	partInstances = 'partInstances',
	partInstancesSimple = 'partInstancesSimple',
	partInstancesForSegmentPlayout = 'partInstancesForSegmentPlayout',
	segments = 'segments',
	showStyleBases = 'showStyleBases',
	showStyleVariants = 'showStyleVariants',
	triggeredActions = 'triggeredActions',
	snapshots = 'snapshots',
	studios = 'studios',
	timeline = 'timeline',
	timelineDatastore = 'timelineDatastore',
	userActionsLog = 'userActionsLog',
	/** @deprecated */
	mediaWorkFlows = 'mediaWorkFlows',
	/** @deprecated */
	mediaWorkFlowSteps = 'mediaWorkFlowSteps',
	rundownLayouts = 'rundownLayouts',
	loggedInUser = 'loggedInUser',
	usersInOrganization = 'usersInOrganization',
	organization = 'organization',
	buckets = 'buckets',
	bucketAdLibPieces = 'bucketAdLibPieces',
	translationsBundles = 'translationsBundles',
	bucketAdLibActions = 'bucketAdLibActions',
	expectedPackages = 'expectedPackages',
	expectedPackageWorkStatuses = 'expectedPackageWorkStatuses',
	packageContainerPackageStatuses = 'packageContainerPackageStatuses',
	packageContainerStatuses = 'packageContainerStatuses',
	packageInfos = 'packageInfos',

	// For a PeripheralDevice
	rundownsForDevice = 'rundownsForDevice',

	// custom publications:
	mappingsForDevice = 'mappingsForDevice',
	timelineForDevice = 'timelineForDevice',
	timelineDatastoreForDevice = 'timelineDatastoreForDevice',
	mappingsForStudio = 'mappingsForStudio',
	timelineForStudio = 'timelineForStudio',
	expectedPackagesForDevice = 'expectedPackagesForDevice',
	uiShowStyleBase = 'uiShowStyleBase',
	uiStudio = 'uiStudio',
	uiTriggeredActions = 'uiTriggeredActions',
	uiSegmentPartNotes = 'uiSegmentPartNotes',
	uiPieceContentStatuses = 'uiPieceContentStatuses',
}

/**
 * Type definitions for all DDP subscriptions.
 * All the PubSub ids must be present here, or they will produce type errors when used
 */
export interface PubSubTypes {
	[PubSub.blueprints]: (selector: MongoQuery<Blueprint>, token?: string) => Blueprint
	[PubSub.coreSystem]: (token?: string) => ICoreSystem
	[PubSub.evaluations]: (selector: MongoQuery<Evaluation>, token?: string) => Evaluation
	[PubSub.expectedPlayoutItems]: (selector: MongoQuery<ExpectedPlayoutItem>, token?: string) => ExpectedPlayoutItem
	[PubSub.expectedMediaItems]: (selector: MongoQuery<ExpectedMediaItem>, token?: string) => ExpectedMediaItem
	[PubSub.externalMessageQueue]: (
		selector: MongoQuery<ExternalMessageQueueObj>,
		token?: string
	) => ExternalMessageQueueObj
	[PubSub.mediaObjects]: (studioId: StudioId, selector: MongoQuery<MediaObject>, token?: string) => MediaObject
	[PubSub.peripheralDeviceCommands]: (deviceId: PeripheralDeviceId, token?: string) => PeripheralDeviceCommand
	[PubSub.peripheralDevices]: (selector: MongoQuery<PeripheralDevice>, token?: string) => PeripheralDevice
	[PubSub.peripheralDevicesAndSubDevices]: (
		selector: MongoQuery<PeripheralDevice>,
		token?: string
	) => PeripheralDevice
	[PubSub.rundownBaselineAdLibPieces]: (
		selector: MongoQuery<RundownBaselineAdLibItem>,
		token?: string
	) => RundownBaselineAdLibItem
	[PubSub.rundownBaselineAdLibActions]: (
		selector: MongoQuery<RundownBaselineAdLibAction>,
		token?: string
	) => RundownBaselineAdLibAction
	[PubSub.ingestDataCache]: (selector: MongoQuery<IngestDataCacheObj>, token?: string) => IngestDataCacheObj
	[PubSub.rundownPlaylists]: (selector: MongoQuery<DBRundownPlaylist>, token?: string) => DBRundownPlaylist
	[PubSub.rundowns]: (
		/** RundownPlaylistId to fetch for, or null to not check */
		playlistIds: RundownPlaylistId[] | null,
		/** ShowStyleBaseId to fetch for, or null to not check */
		showStyleBaseIds: ShowStyleBaseId[] | null,
		token?: string
	) => DBRundown
	[PubSub.adLibActions]: (selector: MongoQuery<AdLibAction>, token?: string) => AdLibAction
	[PubSub.adLibPieces]: (selector: MongoQuery<AdLibPiece>, token?: string) => AdLibPiece
	[PubSub.pieces]: (selector: MongoQuery<Piece>, token?: string) => Piece
	[PubSub.pieceInstances]: (selector: MongoQuery<PieceInstance>, token?: string) => PieceInstance
	[PubSub.pieceInstancesSimple]: (selector: MongoQuery<PieceInstance>, token?: string) => PieceInstance
	[PubSub.parts]: (rundownIds: RundownId[], token?: string) => DBPart
	[PubSub.partInstances]: (
		rundownIds: RundownId[],
		playlistActivationId: RundownPlaylistActivationId | undefined,
		token?: string
	) => PartInstance
	[PubSub.partInstancesSimple]: (selector: MongoQuery<PartInstance>, token?: string) => PartInstance
	[PubSub.partInstancesForSegmentPlayout]: (selector: MongoQuery<PartInstance>, token?: string) => PartInstance
	[PubSub.segments]: (selector: MongoQuery<DBSegment>, token?: string) => DBSegment
	[PubSub.showStyleBases]: (selector: MongoQuery<DBShowStyleBase>, token?: string) => DBShowStyleBase
	[PubSub.showStyleVariants]: (selector: MongoQuery<DBShowStyleVariant>, token?: string) => DBShowStyleVariant
	[PubSub.triggeredActions]: (selector: MongoQuery<DBTriggeredActions>, token?: string) => DBTriggeredActions
	[PubSub.snapshots]: (selector: MongoQuery<SnapshotItem>, token?: string) => SnapshotItem
	[PubSub.studios]: (selector: MongoQuery<DBStudio>, token?: string) => DBStudio
	[PubSub.timeline]: (selector: MongoQuery<TimelineComplete>, token?: string) => TimelineComplete
	[PubSub.timelineDatastore]: (studioId: StudioId, token?: string) => DBTimelineDatastoreEntry
	[PubSub.userActionsLog]: (selector: MongoQuery<UserActionsLogItem>, token?: string) => UserActionsLogItem
	/** @deprecated */
	[PubSub.mediaWorkFlows]: (selector: MongoQuery<MediaWorkFlow>, token?: string) => MediaWorkFlow
	/** @deprecated */
	[PubSub.mediaWorkFlowSteps]: (selector: MongoQuery<MediaWorkFlowStep>, token?: string) => MediaWorkFlowStep
	[PubSub.rundownLayouts]: (selector: MongoQuery<RundownLayoutBase>, token?: string) => RundownLayoutBase
	[PubSub.loggedInUser]: (token?: string) => DBUser
	[PubSub.usersInOrganization]: (selector: MongoQuery<DBUser>, token?: string) => DBUser
	[PubSub.organization]: (selector: MongoQuery<DBOrganization>, token?: string) => DBOrganization
	[PubSub.buckets]: (selector: MongoQuery<Bucket>, token?: string) => Bucket
	[PubSub.bucketAdLibPieces]: (selector: MongoQuery<BucketAdLib>, token?: string) => BucketAdLib
	[PubSub.bucketAdLibActions]: (selector: MongoQuery<BucketAdLibAction>, token?: string) => BucketAdLibAction
	[PubSub.translationsBundles]: (selector: MongoQuery<TranslationsBundle>, token?: string) => TranslationsBundle
	[PubSub.expectedPackages]: (selector: MongoQuery<ExpectedPackageDB>, token?: string) => ExpectedPackageDB
	[PubSub.expectedPackageWorkStatuses]: (
		selector: MongoQuery<ExpectedPackageWorkStatus>,
		token?: string
	) => ExpectedPackageWorkStatus
	[PubSub.packageContainerPackageStatuses]: (
		studioId: StudioId,
		containerId?: string | null,
		packageId?: ExpectedPackageId | null
	) => PackageContainerPackageStatusDB
	[PubSub.packageContainerStatuses]: (
		selector: MongoQuery<PackageContainerStatusDB>,
		token?: string
	) => PackageContainerStatusDB
	[PubSub.packageInfos]: (selector: MongoQuery<PackageInfoDB>, token?: string) => PackageInfoDB

	// For a PeripheralDevice
	[PubSub.rundownsForDevice]: (deviceId: PeripheralDeviceId, token: string) => DBRundown

	// custom publications:
	[PubSub.mappingsForDevice]: (deviceId: PeripheralDeviceId, token?: string) => RoutedMappings
	[PubSub.timelineForDevice]: (deviceId: PeripheralDeviceId, token?: string) => RoutedTimeline
	[PubSub.timelineDatastoreForDevice]: (deviceId: PeripheralDeviceId, token?: string) => DBTimelineDatastoreEntry
	[PubSub.mappingsForStudio]: (studioId: StudioId, token?: string) => RoutedMappings
	[PubSub.timelineForStudio]: (studioId: StudioId, token?: string) => RoutedTimeline
	[PubSub.expectedPackagesForDevice]: (
		deviceId: PeripheralDeviceId,
		filterPlayoutDeviceIds: PeripheralDeviceId[] | undefined,
		token?: string
	) => DBObj
	[PubSub.uiShowStyleBase]: (showStyleBaseId: ShowStyleBaseId) => UIShowStyleBase
	/** Subscribe to one or all studios */
	[PubSub.uiStudio]: (studioId: StudioId | null) => UIStudio
	[PubSub.uiTriggeredActions]: (showStyleBaseId: ShowStyleBaseId | null) => UITriggeredActionsObj
	[PubSub.uiSegmentPartNotes]: (playlistId: RundownPlaylistId | null) => UISegmentPartNote
	[PubSub.uiPieceContentStatuses]: (rundownPlaylistId: RundownPlaylistId | null) => UIPieceContentStatus
}

/**
 * Ids of possible Custom collections, populated by DDP subscriptions
 */
export enum CustomCollectionName {
	StudioMappings = 'studioMappings',
	StudioTimeline = 'studioTimeline',
	ExpectedPackagesForDevice = 'deviceExpectedPackages',
	UIShowStyleBase = 'uiShowStyleBase',
	UIStudio = 'uiStudio',
	UITriggeredActions = 'uiTriggeredActions',
	UISegmentPartNotes = 'uiSegmentPartNotes',
	UIPieceContentStatuses = 'uiPieceContentStatuses',
}

/**
 * Type definitions for all custom collections.
 * All the CustomCollectionName ids must be present here, or they will produce type errors when used
 */
export type CustomCollectionType = {
	[CustomCollectionName.StudioMappings]: RoutedMappings
	[CustomCollectionName.StudioTimeline]: RoutedTimeline
	[CustomCollectionName.ExpectedPackagesForDevice]: DBObj
	[CustomCollectionName.UIShowStyleBase]: UIShowStyleBase
	[CustomCollectionName.UIStudio]: UIStudio
	[CustomCollectionName.UITriggeredActions]: UITriggeredActionsObj
	[CustomCollectionName.UISegmentPartNotes]: UISegmentPartNote
	[CustomCollectionName.UIPieceContentStatuses]: UIPieceContentStatus
}

/**
 * Type safe wrapper around Meteor.subscribe()
 * @param name name of the subscription
 * @param args arguments to the subscription
 * @returns Meteor subscription handle
 */
export function meteorSubscribe<K extends keyof PubSubTypes>(
	name: K,
	...args: Parameters<PubSubTypes[K]>
): Meteor.SubscriptionHandle {
	if (Meteor.isClient) {
		return Meteor.subscribe(name, ...args)
	} else throw new Meteor.Error(500, 'meteorSubscribe is only available client-side')
}
