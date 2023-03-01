import React from 'react'
import { useSubscription, useTracker } from '../../lib/ReactMeteorData/ReactMeteorData'
import { EvsContent, SourceLayerType } from '@sofie-automation/blueprints-integration'

import { PubSub } from '../../../lib/api/pubsub'
import { IPropsHeader } from './PieceIcon'
import { findPieceInstanceToShow } from './utils'
import { PieceGeneric } from '../../../lib/collections/Pieces'
import { RundownPlaylistActivationId } from '@sofie-automation/corelib/dist/dataModel/Ids'

interface INamePropsHeader extends IPropsHeader {
	partName: string
	playlistActivationId: RundownPlaylistActivationId | undefined
}

const supportedLayers = new Set([
	SourceLayerType.GRAPHICS,
	SourceLayerType.LIVE_SPEAK,
	SourceLayerType.VT,
	SourceLayerType.LOCAL,
])

function getLocalPieceLabel(piece: PieceGeneric): JSX.Element | null {
	const { color } = piece.content as EvsContent
	return (
		<>
			{color && (
				<span style={{ color: color.startsWith('#') ? color : `#${color}` }} className="piece__label__colored-mark">
					·
				</span>
			)}
			{piece.name}
		</>
	)
}

function getPieceLabel(piece: PieceGeneric, type: SourceLayerType): JSX.Element | null {
	switch (type) {
		case SourceLayerType.LOCAL:
			return getLocalPieceLabel(piece)
		default:
			return <>{piece.name}</>
	}
}

export function PieceNameContainer(props: INamePropsHeader): JSX.Element | null {
	const { sourceLayer, pieceInstance } = useTracker(
		() => findPieceInstanceToShow(props, supportedLayers),
		[props.partInstanceId, props.showStyleBaseId],
		{
			sourceLayer: undefined,
			pieceInstance: undefined,
		}
	)

	useSubscription(PubSub.pieceInstancesSimple, {
		rundownId: { $in: props.rundownIds },
		playlistActivationId: props.playlistActivationId,
	})

	useSubscription(PubSub.uiShowStyleBase, props.showStyleBaseId)

	if (pieceInstance && sourceLayer && supportedLayers.has(sourceLayer.type)) {
		return getPieceLabel(pieceInstance.piece, sourceLayer.type)
	}
	return <>{props.partName || ''}</>
}
