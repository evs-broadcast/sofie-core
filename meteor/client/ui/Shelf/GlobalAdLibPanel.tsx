import React, { useMemo } from 'react'
import { RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { IAdLibListItem } from './AdLibListItem'
import { AdLibPanel } from './AdLibPanel'
import { PieceUi } from '../SegmentTimeline/SegmentTimelineContainer'
import { BucketAdLibActionUi, BucketAdLibUi } from './RundownViewBuckets'
import { literal } from '../../../lib/lib'
import {
	PieceDisplayStyle,
	RundownLayoutElementType,
	RundownLayoutFilter,
} from '../../../lib/collections/RundownLayouts'
import { ShelfTabs } from './Shelf'
import { useTranslation } from 'react-i18next'
import { AdLibPieceUi } from '../../lib/shelf'
import { UIShowStyleBase } from '../../../lib/api/showStyles'
import { UIStudio } from '../../../lib/api/studios'

interface IProps {
	playlist: RundownPlaylist
	showStyleBase: UIShowStyleBase
	studio: UIStudio
	visible: boolean
	studioMode: boolean
	selectedPiece: BucketAdLibActionUi | BucketAdLibUi | IAdLibListItem | PieceUi | undefined

	onSelectPiece?: (piece: AdLibPieceUi | PieceUi) => void
}

export function GlobalAdLibPanel({
	playlist,
	studio,
	showStyleBase,
	selectedPiece,
	studioMode,
	visible,
	onSelectPiece,
}: IProps): JSX.Element {
	const { t } = useTranslation()

	const GLOBAL_ADLIB_FILTER: RundownLayoutFilter = useMemo(
		() =>
			literal<RundownLayoutFilter>({
				_id: ShelfTabs.GLOBAL_ADLIB,
				rundownBaseline: 'only',
				name: t('Global AdLib'),
				sourceLayerIds: undefined,
				outputLayerIds: undefined,
				type: RundownLayoutElementType.FILTER,
				default: false,
				sourceLayerTypes: undefined,
				label: undefined,
				tags: undefined,
				displayStyle: PieceDisplayStyle.LIST,
				currentSegment: false,
				hideDuplicates: false,
				rank: 1,
				nextInCurrentPart: false,
				oneNextPerSourceLayer: false,
				showThumbnailsInList: false,
				disableHoverInspector: false,
			}),
		[t]
	)

	return (
		<AdLibPanel
			playlist={playlist}
			studio={studio}
			showStyleBase={showStyleBase}
			selectedPiece={selectedPiece}
			onSelectPiece={onSelectPiece}
			studioMode={studioMode}
			visible={visible}
			includeGlobalAdLibs={true}
			filter={GLOBAL_ADLIB_FILTER}
		/>
	)
}
