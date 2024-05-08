import React, { useEffect, useMemo, useRef, useState } from 'react'
import classNames from 'classnames'
// @ts-expect-error No types available
import * as VelocityReact from 'velocity-react'
import { ISourceLayerExtended, PartExtended, PieceExtended } from '../../../../lib/Rundown'
import StudioContext from '../../RundownView/StudioContext'
import { StoryboardSecondaryPiece } from './StoryboardSecondaryPiece'
import { getCurrentTime } from '../../../../lib/lib'
import { useInvalidateTimeout } from '../../../lib/lib'
import { Meteor } from 'meteor/meteor'
import { HOVER_TIMEOUT } from '../../Shelf/DashboardPieceButton'
import { PieceInstanceId } from '@sofie-automation/corelib/dist/dataModel/Ids'

interface IProps {
	sourceLayer: ISourceLayerExtended
	pieces: PieceExtended[]
	part: PartExtended
}

// needs to match .segment-storyboard__part__source-layer--multiple-piece > .segment-storyboard__part__piece width CSS property
const MULTIPLE_PIECES_PIECE_WIDTH = 0.8

/**
 * Calculate which pieces should now be playing and which have already stopped playing. Return the IDs of the playing
 * and finished PieceInstances.
 *
 * @param {(number | undefined)} partInstanceStartedPlayback
 * @param {(number | undefined)} partInstanceStoppedPlayback
 * @param {PieceExtended[]} piecesOnLayer
 * @return {*}
 */
function usePlayedOutPieceState(
	partInstanceStartedPlayback: number | undefined,
	partInstanceStoppedPlayback: number | undefined,
	piecesOnLayer: PieceExtended[]
) {
	return useInvalidateTimeout(() => {
		if (partInstanceStartedPlayback === undefined) {
			return [EMPTY_PLAYED_PIECE_IDS, ONCE_A_MINUTE + Math.random() * 1000]
		}

		const playedPieceIds: PieceInstanceId[] = []
		const finishedPieceIds: PieceInstanceId[] = []

		const startedPlayback = partInstanceStartedPlayback
		const stoppedPlayback = partInstanceStoppedPlayback ?? Number.POSITIVE_INFINITY
		let closestAbsoluteNext = Number.POSITIVE_INFINITY

		// the pieces are in anti-chronological order for conveniece elsewhere, so we need to go from the end
		// of the array
		for (let i = piecesOnLayer.length - 1; i >= 0; i--) {
			const piece = piecesOnLayer[i]

			if (piece.renderedInPoint === null) continue

			const absoluteRenderedInPoint = startedPlayback + piece.renderedInPoint
			if (absoluteRenderedInPoint < getCurrentTime() && absoluteRenderedInPoint < stoppedPlayback) {
				playedPieceIds.push(piece.instance._id)
			} else {
				if (absoluteRenderedInPoint < closestAbsoluteNext) {
					closestAbsoluteNext = absoluteRenderedInPoint
				}
			}

			if (piece.renderedDuration === null) continue

			const absoluteRenderedOutPoint = absoluteRenderedInPoint + piece.renderedDuration
			if (absoluteRenderedOutPoint < getCurrentTime() && absoluteRenderedOutPoint < stoppedPlayback) {
				finishedPieceIds.push(piece.instance._id)
			} else {
				if (absoluteRenderedOutPoint < closestAbsoluteNext) {
					closestAbsoluteNext = absoluteRenderedOutPoint
				}
			}
		}

		const nextRevalidation = Number.isFinite(closestAbsoluteNext)
			? // the next closest change is in that time, so let's wait until then
			  Math.max(1, closestAbsoluteNext - getCurrentTime())
			: // the part has stopped playing, so we can stop checking
			Number.isFinite(stoppedPlayback)
			? 0
			: // if all Pieces are finished, we can stop updating, because piecesOnLayer will change anyway if
			// anything happens to the Pieces
			finishedPieceIds.length === piecesOnLayer.length
			? 0
			: // essentially a fallback, we shouldn't hit this condition ever
			  10000 + Math.random() * 1000

		return [
			{
				playedPieceIds,
				finishedPieceIds,
			},
			nextRevalidation,
		]
	}, [partInstanceStartedPlayback, partInstanceStoppedPlayback, piecesOnLayer])
}

const ONCE_A_MINUTE = 60000
const EMPTY_PLAYED_PIECE_IDS = { playedPieceIds: [], finishedPieceIds: [] }

export function StoryboardSourceLayer({ pieces, sourceLayer, part }: Readonly<IProps>): JSX.Element {
	const [hoverIndex, setHoverIndex] = useState<number | null>(null)
	const hoverTimeout = useRef<number | null>(null)

	const partId = part?.partId

	const piecesOnLayer = useMemo(
		() =>
			pieces
				.filter(
					(piece) =>
						(piece.renderedDuration === null || piece.renderedDuration > 0) &&
						piece.instance.piece.virtual !== true &&
						piece.sourceLayer?._id === sourceLayer._id
				)
				.reverse(),
		[pieces]
	)

	const nonInfinitePieceCount = useMemo(
		() => piecesOnLayer.filter((piece) => piece.renderedDuration !== null).length,
		[piecesOnLayer]
	)

	const playedOutState = usePlayedOutPieceState(
		part?.instance.timings?.plannedStartedPlayback,
		part?.instance.timings?.plannedStoppedPlayback,
		piecesOnLayer
	)

	let playingIds: PieceInstanceId[] = []
	let finishedIds: PieceInstanceId[] = []

	if (playedOutState) {
		playingIds = playedOutState.playedPieceIds
		finishedIds = playedOutState.finishedPieceIds
	}

	const pieceCount = piecesOnLayer.length - finishedIds.length

	const offset = (1 - 0.8) / (pieceCount - 1 || 1)

	// the first piece found will be the "latest finished"
	const lastFinished = piecesOnLayer.find((pieceInstance) => finishedIds.includes(pieceInstance.instance._id))
	const topmostPieceIndex = lastFinished ? piecesOnLayer.indexOf(lastFinished) - 1 : piecesOnLayer.length - 1

	const onPointerEnter = (e: React.PointerEvent<HTMLDivElement>) => {
		if (e.pointerType === 'mouse') {
			hoverTimeout.current = Meteor.setTimeout(() => setHoverIndex(null), HOVER_TIMEOUT)
		}
	}

	const clearHoverTimeout = () => {
		if (hoverTimeout.current) {
			Meteor.clearTimeout(hoverTimeout.current)
			hoverTimeout.current = null
		}
	}

	const onPointerLeave = (e: React.PointerEvent<HTMLDivElement>) => {
		if (e.pointerType === 'mouse') {
			clearHoverTimeout()
			setHoverIndex(null)
		}
	}

	const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
		if (e.pointerType === 'mouse') {
			clearHoverTimeout()
			hoverTimeout.current = Meteor.setTimeout(() => setHoverIndex(null), HOVER_TIMEOUT)
		}
	}

	useEffect(() => {
		return () => clearHoverTimeout()
	}, [])

	return (
		<div
			className={classNames('segment-storyboard__part__source-layer', {
				'segment-storyboard__part__source-layer--multiple-piece': nonInfinitePieceCount > 0,
				hover: hoverIndex !== null,
			})}
			data-obj-id={sourceLayer._id}
			onPointerEnter={onPointerEnter}
			onPointerLeave={onPointerLeave}
			onPointerMove={onPointerMove}
		>
			{piecesOnLayer.map((piece, index) => {
				const isFinished = finishedIds.includes(piece.instance._id)

				return (
					<VelocityReact.VelocityComponent
						key={piece.instance._id}
						animation={{
							translateX:
								pieceCount > 1
									? `${Math.max(0, (offset * (pieceCount - 1 - index) * 100) / MULTIPLE_PIECES_PIECE_WIDTH)}%`
									: undefined,
							translateY: isFinished ? [25, 0] : undefined,
							opacity: isFinished ? [0, 1] : 1,
						}}
						duration={350}
					>
						<StudioContext.Consumer>
							{(studio) => (
								<StoryboardSecondaryPiece
									piece={piece}
									studio={studio}
									isLiveLine={false}
									layer={sourceLayer}
									partId={partId}
									className={classNames({
										'segment-storyboard__part__piece--frontmost':
											hoverIndex !== null ? hoverIndex === index : topmostPieceIndex === index,
										'segment-storyboard__part__piece--playing':
											piece.renderedDuration !== null && playingIds.includes(piece.instance._id),
										hover: index === hoverIndex,
									})}
									style={{
										//@ts-expect-error: CSS Variable
										'--piece-playback-duration': `${piece.renderedDuration}ms`,
										zIndex:
											hoverIndex !== null
												? index <= hoverIndex
													? piecesOnLayer.length + index
													: piecesOnLayer.length - index
												: undefined,
									}}
									onPointerEnter={() => setHoverIndex(index)}
								/>
							)}
						</StudioContext.Consumer>
					</VelocityReact.VelocityComponent>
				)
			})}
		</div>
	)
}
