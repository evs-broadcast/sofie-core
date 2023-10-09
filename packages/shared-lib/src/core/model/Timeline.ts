import { unprotectString, protectString } from '../../lib/protectedString'
import { TSR } from '../../tsr'
import { MappingsHash, PeripheralDeviceId, StudioId, TimelineBlob, TimelineHash } from './Ids'

/**
 * This defines a session, indicating that this TimelineObject uses an AB player
 */
export interface TimelineObjectAbSessionInfo {
	/**
	 * Name for this session
	 * This should be the same for other pieces/objects which should share this session
	 * This name is scoped to the Segment, any unrelated sessions in the segment must use different names
	 */
	sessionName: string
	/**
	 * The name of the AB Pool this session is for
	 */
	poolName: string
}

export enum TimelineObjHoldMode {
	/** Default: The object is played as usual (behaviour is not affected by Hold)  */
	NORMAL = 0,
	/** The object is played ONLY when doing a Hold */
	ONLY = 1,
	/** The object is played when NOT doing a Hold */
	EXCEPT = 2,
}

export interface TimelineObjectCoreExt<
	TContent extends { deviceType: TSR.DeviceType },
	TMetadata = unknown,
	TKeyframeMetadata = unknown
> extends TSR.TSRTimelineObj<TContent> {
	/**
	 * AB playback sessions needed for this Object
	 */
	abSessions?: Array<TimelineObjectAbSessionInfo>

	/** Restrict object usage according to whether we are currently in a hold */
	holdMode?: TimelineObjHoldMode
	/** Arbitrary data storage for plugins */
	metaData?: TMetadata
	/** Keyframes: Arbitrary data storage for plugins */
	keyframes?: Array<TimelineKeyframeCoreExt<TContent, TKeyframeMetadata>>
}

export interface TimelineKeyframeCoreExt<TContent extends { deviceType: TSR.DeviceType }, TKeyframeMetadata = unknown>
	extends TSR.Timeline.TimelineKeyframe<TContent> {
	metaData?: TKeyframeMetadata
	/** Whether to keep this keyframe when the object is copied for lookahead. By default all keyframes are removed */
	preserveForLookahead?: boolean

	abSession?: {
		poolName: string
		playerIndex: number | string
	}
}

export type TimelineEnableExt = TSR.Timeline.TimelineEnable & { setFromNow?: boolean }

export enum TimelineObjType {
	/** Objects played in a rundown */
	RUNDOWN = 'rundown',
}
export interface TimelineObjGeneric extends TimelineObjectCoreExt<TSR.TSRTimelineContent> {
	/** Unique within a timeline (ie within a studio) */
	id: string
	/** Set when the id of the object is prefixed */
	originalId?: string

	objectType: TimelineObjType

	enable: TimelineEnableExt | TimelineEnableExt[]

	/** The id of the group object this object is in  */
	inGroup?: string
}

/** This is the data-object published from Core */
export interface RoutedTimeline {
	_id: StudioId
	/** Hash of the studio mappings */
	mappingsHash: MappingsHash | undefined

	/** Hash of the Timeline */
	timelineHash: TimelineHash

	/** serialized JSON Array containing all timeline-objects */
	timelineBlob: TimelineBlob
	generated: number
}

export enum LookaheadMode {
	NONE = 0,
	PRELOAD = 1,
	// RETAIN = 2, // Removed due to complexity and it being possible to emulate with WHEN_CLEAR and infinites
	WHEN_CLEAR = 3,
}

export interface BlueprintMappings extends TSR.Mappings {
	[layerName: string]: BlueprintMapping
}
export interface BlueprintMapping<TOptions extends { mappingType: string } | unknown = TSR.TSRMappingOptions>
	extends TSR.Mapping<TOptions> {
	/** What method core should use to create lookahead objects for this layer */
	lookahead: LookaheadMode
	/** How many lookahead objects to create for this layer. Default = 1 */
	lookaheadDepth?: number
	/** Maximum distance to search for lookahead. Default = 10 */
	lookaheadMaxSearchDistance?: number
}

export interface MappingsExt {
	[layerName: string]: MappingExt
}
export interface MappingExt<TOptions extends { mappingType: string } | unknown = TSR.TSRMappingOptions>
	extends Omit<BlueprintMapping<TOptions>, 'deviceId'> {
	deviceId: PeripheralDeviceId
}
export interface RoutedMappings {
	_id: StudioId
	mappingsHash: MappingsHash | undefined
	mappings: MappingsExt
}

export function deserializeTimelineBlob(timelineBlob: TimelineBlob): TimelineObjGeneric[] {
	return JSON.parse(unprotectString(timelineBlob)) as Array<TimelineObjGeneric>
}
export function serializeTimelineBlob(timeline: TimelineObjGeneric[]): TimelineBlob {
	return protectString(JSON.stringify(timeline))
}
