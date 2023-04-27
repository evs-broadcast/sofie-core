import React from 'react'
import { SplitsContent } from '@sofie-automation/blueprints-integration'
import { IProps } from './ThumbnailRendererFactory'
import { RundownUtils } from '../../../../lib/rundown'
import { SplitsFloatingInspector } from '../../../FloatingInspectors/SplitsFloatingInspector'
import { getSplitItems } from '../../../SegmentContainer/getSplitItems'

export function SplitsThumbnailRenderer({ pieceInstance, originPosition, hovering, layer }: IProps): JSX.Element {
	const splitItems = getSplitItems(pieceInstance, 'segment-storyboard__thumbnail__item')

	return (
		<>
			<div className="segment-storyboard__thumbnail__contents">{splitItems}</div>
			<div className="segment-storyboard__thumbnail__label segment-storyboard__thumbnail__label--lg">
				{pieceInstance.instance.piece.name}
			</div>
			<SplitsFloatingInspector
				position={{
					top: originPosition.top,
					left: originPosition.left,
					anchor: 'start',
					position: 'top',
				}}
				content={pieceInstance.instance.piece.content as Partial<SplitsContent>}
				itemElement={null}
				showMiniInspector={hovering}
				typeClass={layer && RundownUtils.getSourceLayerClassName(layer.type)}
			/>
		</>
	)
}
