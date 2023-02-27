import React from 'react'
import ClassNames from 'classnames'
import { faPencilAlt, faTrash, faCheck, faExclamationTriangle, faPlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { IOutputLayer } from '@sofie-automation/blueprints-integration'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { Random } from 'meteor/random'
import Tooltip from 'rc-tooltip'
import { withTranslation } from 'react-i18next'
import { ShowStyleBase, ShowStyleBases } from '../../../../lib/collections/ShowStyleBases'
import { EditAttribute, EditAttributeBase } from '../../../lib/EditAttribute'
import { getHelpMode } from '../../../lib/localStorage'
import { doModalDialog } from '../../../lib/ModalDialog'
import { Translated } from '../../../lib/ReactMeteorData/ReactMeteorData'
import { findHighestRank } from '../StudioSettings'
import { Meteor } from 'meteor/meteor'

interface IOutputSettingsProps {
	showStyleBase: ShowStyleBase
}
interface IOutputSettingsState {
	editedOutputs: Array<string>
}

export const OutputLayerSettings = withTranslation()(
	class OutputSettings extends React.Component<Translated<IOutputSettingsProps>, IOutputSettingsState> {
		constructor(props: Translated<IOutputSettingsProps>) {
			super(props)

			this.state = {
				editedOutputs: [],
			}
		}

		isPGMChannelSet() {
			return !!Object.values(this.props.showStyleBase.outputLayersWithOverrides.defaults).find(
				(layer) => layer && layer.isPGM
			)
		}

		isItemEdited = (item: IOutputLayer) => {
			return this.state.editedOutputs.indexOf(item._id) >= 0
		}

		finishEditItem = (item: Pick<IOutputLayer, '_id'>) => {
			const index = this.state.editedOutputs.indexOf(item._id)
			if (index >= 0) {
				this.state.editedOutputs.splice(index, 1)
				this.setState({
					editedOutputs: this.state.editedOutputs,
				})
			}
		}

		editItem = (item: Pick<IOutputLayer, '_id'>) => {
			if (this.state.editedOutputs.indexOf(item._id) < 0) {
				this.state.editedOutputs.push(item._id)
				this.setState({
					editedOutputs: this.state.editedOutputs,
				})
			} else {
				this.finishEditItem(item)
			}
		}

		confirmDelete = (output: IOutputLayer) => {
			const { t } = this.props
			doModalDialog({
				title: t('Delete this output?'),
				no: t('Cancel'),
				yes: t('Delete'),
				onAccept: () => {
					this.onDeleteOutput(output)
				},
				message: (
					<React.Fragment>
						<p>
							{t('Are you sure you want to delete source layer "{{outputId}}"?', { outputId: output && output.name })}
						</p>
						<p>{t('Please note: This action is irreversible!')}</p>
					</React.Fragment>
				),
			})
		}
		onAddOutput = () => {
			const maxRank = findHighestRank(Object.values(this.props.showStyleBase.outputLayersWithOverrides.defaults))
			const { t } = this.props

			const newOutput = literal<IOutputLayer>({
				_id: this.props.showStyleBase._id + '-' + Random.id(5),
				_rank: maxRank ? maxRank._rank + 10 : 0,
				name: t('New Output'),
				isPGM: false,
			})

			ShowStyleBases.update(this.props.showStyleBase._id, {
				$set: {
					[`outputLayersWithOverrides.defaults.${newOutput._id}`]: newOutput,
				},
			})
		}
		onDeleteOutput = (item: IOutputLayer) => {
			if (this.props.showStyleBase) {
				ShowStyleBases.update(this.props.showStyleBase._id, {
					$unset: {
						[`outputLayersWithOverrides.defaults.${item._id}`]: 1,
					},
				})
			}
		}
		updateLayerId = (edit: EditAttributeBase, newValue: string) => {
			const oldLayerId = edit.props.overrideDisplayValue
			const newLayerId = newValue + ''
			const layer = this.props.showStyleBase.outputLayersWithOverrides.defaults[oldLayerId]

			if (!layer || !edit.props.collection) {
				return
			}

			if (this.props.showStyleBase.outputLayersWithOverrides.defaults[newLayerId]) {
				throw new Meteor.Error(400, 'Layer "' + newLayerId + '" already exists')
			}

			edit.props.collection.update(this.props.showStyleBase._id, {
				$set: {
					[`outputLayersWithOverrides.defaults.${newLayerId}`]: {
						...layer,
						_id: newLayerId,
					},
				},
				$unset: {
					[`outputLayersWithOverrides.defaults.${oldLayerId}`]: 1,
				},
			})

			this.finishEditItem({ _id: oldLayerId })
			this.editItem({ _id: newLayerId })
		}

		renderOutputs() {
			const { t } = this.props
			return Object.values(this.props.showStyleBase.outputLayersWithOverrides.defaults)
				.filter((l): l is IOutputLayer => !!l)
				.sort((a, b) => {
					return a._rank - b._rank
				})
				.map((item) => {
					return [
						<tr
							key={item._id}
							className={ClassNames({
								hl: this.isItemEdited(item),
							})}
						>
							<th className="settings-studio-output-table__name c2">{item.name}</th>
							<td className="settings-studio-output-table__id c4">{item._id}</td>
							<td className="settings-studio-output-table__isPGM c3">
								<div
									className={ClassNames('switch', 'switch-tight', {
										'switch-active': item.isPGM,
									})}
								>
									PGM
								</div>
							</td>
							<td className="settings-studio-output-table__actions table-item-actions c3">
								<button className="action-btn" onClick={() => this.editItem(item)}>
									<FontAwesomeIcon icon={faPencilAlt} />
								</button>
								<button className="action-btn" onClick={() => this.confirmDelete(item)}>
									<FontAwesomeIcon icon={faTrash} />
								</button>
							</td>
						</tr>,
						this.isItemEdited(item) ? (
							<tr className="expando-details hl" key={item._id + '-details'}>
								<td colSpan={4}>
									<div>
										<div className="mod mvs mhs">
											<label className="field">
												{t('Channel Name')}
												<EditAttribute
													modifiedClassName="bghl"
													attribute={'outputLayersWithOverrides.defaults.' + item._id + '.name'}
													obj={this.props.showStyleBase}
													type="text"
													collection={ShowStyleBases}
													className="input text-input input-l"
												></EditAttribute>
											</label>
										</div>
										<div className="mod mvs mhs">
											<label className="field">
												{t('Internal ID')}
												<EditAttribute
													modifiedClassName="bghl"
													attribute={'outputLayersWithOverrides.defaults.' + item._id + '._id'}
													obj={this.props.showStyleBase}
													type="text"
													collection={ShowStyleBases}
													className="input text-input input-l"
													overrideDisplayValue={item._id}
													updateFunction={this.updateLayerId}
												></EditAttribute>
											</label>
										</div>
										<div className="mod mvs mhs">
											<label className="field">
												<EditAttribute
													modifiedClassName="bghl"
													attribute={'outputLayersWithOverrides.defaults.' + item._id + '.isPGM'}
													obj={this.props.showStyleBase}
													type="checkbox"
													collection={ShowStyleBases}
													className=""
												></EditAttribute>
												{t('Is PGM Output')}
											</label>
										</div>
										<div className="mod mvs mhs">
											<label className="field">
												{t('Display Rank')}
												<EditAttribute
													modifiedClassName="bghl"
													attribute={'outputLayersWithOverrides.defaults.' + item._id + '._rank'}
													obj={this.props.showStyleBase}
													type="int"
													collection={ShowStyleBases}
													className="input text-input input-l"
												></EditAttribute>
											</label>
										</div>
										<div className="mod mvs mhs">
											<label className="field">
												<EditAttribute
													modifiedClassName="bghl"
													attribute={'outputLayersWithOverrides.defaults.' + item._id + '.isDefaultCollapsed'}
													obj={this.props.showStyleBase}
													type="checkbox"
													collection={ShowStyleBases}
													className=""
												></EditAttribute>
												{t('Is collapsed by default')}
											</label>
										</div>
										<div className="mod mvs mhs">
											<label className="field">
												<EditAttribute
													modifiedClassName="bghl"
													attribute={'outputLayersWithOverrides.defaults.' + item._id + '.isFlattened'}
													obj={this.props.showStyleBase}
													type="checkbox"
													collection={ShowStyleBases}
													className=""
												></EditAttribute>
												{t('Is flattened')}
											</label>
										</div>
									</div>
									<div className="mod alright">
										<button className="btn btn-primary" onClick={() => this.finishEditItem(item)}>
											<FontAwesomeIcon icon={faCheck} />
										</button>
									</div>
								</td>
							</tr>
						) : null,
					]
				})
		}

		render() {
			const { t } = this.props

			const outputLayerCount = Object.keys(this.props.showStyleBase.outputLayersWithOverrides.defaults).length

			return (
				<div>
					<h2 className="mhn">
						<Tooltip
							overlay={t('Output channels are required for your studio to work')}
							visible={getHelpMode() && !outputLayerCount}
							placement="top"
						>
							<span>{t('Output channels')}</span>
						</Tooltip>
					</h2>
					{!outputLayerCount ? (
						<div className="error-notice">
							<FontAwesomeIcon icon={faExclamationTriangle} /> {t('No output channels set')}
						</div>
					) : null}
					{!this.isPGMChannelSet() ? (
						<div className="error-notice">
							<FontAwesomeIcon icon={faExclamationTriangle} /> {t('No PGM output')}
						</div>
					) : null}
					<table className="expando settings-studio-output-table">
						<tbody>{this.renderOutputs()}</tbody>
					</table>
					<div className="mod mhs">
						<button className="btn btn-primary" onClick={this.onAddOutput}>
							<FontAwesomeIcon icon={faPlus} />
						</button>
					</div>
				</div>
			)
		}
	}
)
