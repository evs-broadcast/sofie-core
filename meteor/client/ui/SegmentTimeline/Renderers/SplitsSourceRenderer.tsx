import * as React from 'react'
import { getElementWidth } from '../../../utils/dimensions'

import ClassNames from 'classnames'
import { CustomLayerItemRenderer, ICustomLayerItemProps } from './CustomLayerItemRenderer'

import { SplitsContent } from '@sofie-automation/blueprints-integration'
import { RundownUtils } from '../../../lib/rundown'
import { SplitsFloatingInspector } from '../../FloatingInspectors/SplitsFloatingInspector'
import { getSplitPreview, SplitRole, SplitSubItem } from '../../../lib/ui/splitPreview'

type IProps = ICustomLayerItemProps

interface IState {
	subItems: ReadonlyArray<SplitSubItem>
}

export class SplitsSourceRenderer extends CustomLayerItemRenderer<IProps, IState> {
	leftLabel: HTMLSpanElement | null
	rightLabel: HTMLSpanElement | null

	constructor(props) {
		super(props)
		this.state = {
			subItems: [],
		}
	}

	static getDerivedStateFromProps(props: IProps): IState {
		let subItems: ReadonlyArray<SplitSubItem> = []
		const splitContent = props.piece.instance.piece.content as Partial<SplitsContent> | undefined
		if (splitContent && splitContent.boxSourceConfiguration) {
			subItems = getSplitPreview(splitContent.boxSourceConfiguration)
		}

		return {
			subItems: subItems,
		}
	}

	setLeftLabelRef = (e: HTMLSpanElement) => {
		this.leftLabel = e
	}

	setRightLabelRef = (e: HTMLSpanElement) => {
		this.rightLabel = e
	}

	componentDidMount() {
		this.updateAnchoredElsWidths()
	}

	updateAnchoredElsWidths = () => {
		const leftLabelWidth = this.leftLabel ? Math.max(0, getElementWidth(this.leftLabel) - 2) : 0
		const rightLabelWidth = this.rightLabel ? Math.max(0, getElementWidth(this.rightLabel) - 2) : 0

		this.setAnchoredElsWidths(leftLabelWidth, rightLabelWidth)
	}

	componentDidUpdate(prevProps: Readonly<IProps>, prevState: Readonly<IState>) {
		if (super.componentDidUpdate && typeof super.componentDidUpdate === 'function') {
			super.componentDidUpdate(prevProps, prevState)
		}

		if (this.props.piece.instance.piece.name !== prevProps.piece.instance.piece.name) {
			this.updateAnchoredElsWidths()
		}
	}

	renderSubItems() {
		return this.state.subItems
			.filter((i) => i.role !== SplitRole.ART)
			.reverse()
			.map((item, index, array) => {
				return (
					<div
						key={'item-' + item._id}
						className={ClassNames(
							'segment-timeline__piece__preview__item',
							RundownUtils.getSourceLayerClassName(item.type),
							{
								second: array.length > 1 && index > 0 && item.type === array[index - 1].type,
							},
							{ upper: index >= array.length / 2 },
							{ lower: index < array.length / 2 }
						)}
					></div>
				)
			})
	}

	render() {
		const labelItems = this.props.piece.instance.piece.name.split('||')
		const begin = labelItems[0] || ''
		const end = labelItems[1] || ''

		return (
			<React.Fragment>
				<div className="segment-timeline__piece__preview">{this.renderSubItems()}</div>
				{!this.props.isTooSmallForText && (
					<>
						{!this.props.piece.hasOriginInPreceedingPart || this.props.isLiveLine ? (
							<span
								className={ClassNames('segment-timeline__piece__label first-words', {
									'overflow-label': end !== '',
								})}
								ref={this.setLeftLabelRef}
								style={this.getItemLabelOffsetLeft()}
							>
								{begin}
							</span>
						) : null}
						<span
							className="segment-timeline__piece__label right-side"
							ref={this.setRightLabelRef}
							style={this.getItemLabelOffsetRight()}
						>
							{end && <span className="segment-timeline__piece__label last-words">{end}</span>}
							{this.renderInfiniteIcon()}
							{this.renderOverflowTimeLabel()}
						</span>
					</>
				)}
				{this.props.piece.instance.piece.content ? (
					<SplitsFloatingInspector
						floatingInspectorStyle={this.getFloatingInspectorStyle()}
						content={this.props.piece.instance.piece.content as Partial<SplitsContent>}
						itemElement={this.props.itemElement}
						showMiniInspector={this.props.showMiniInspector}
						typeClass={this.props.typeClass}
					/>
				) : null}
			</React.Fragment>
		)
	}
}
