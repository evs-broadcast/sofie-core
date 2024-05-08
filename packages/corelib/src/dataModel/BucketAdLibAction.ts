import { BucketAdLibActionId, BucketId, StudioId, ShowStyleVariantId, ShowStyleBaseId } from './Ids'
import { RundownImportVersions } from './Rundown'
import { AdLibActionCommon } from './AdlibAction'
import { BucketAdLibIngestInfo } from './BucketAdLibPiece'

export interface BucketAdLibAction extends Omit<AdLibActionCommon, 'rundownId'> {
	_id: BucketAdLibActionId
	bucketId: BucketId

	externalId: string

	/**
	 * If an AdLib within the Bucket doesn't match the studioId/showStyleVariantId combination
	 * the adLib will be shown as disabled
	 */
	studioId: StudioId
	/** Which ShowStyleBase the adlib action is valid for */
	showStyleBaseId: ShowStyleBaseId
	/** if showStyleVariantId is null, the adlibAction can be used with any variant */
	showStyleVariantId: ShowStyleVariantId | null
	importVersions: RundownImportVersions // TODO - is this good?
	/** Information used to generate the adlib. If set, this adlib can be regenerated */
	ingestInfo: BucketAdLibIngestInfo | undefined

	/** The following extended interface allows assigning namespace information to the actions as they are stored in the
	 *  database after being emitted from the blueprints
	 */
}
