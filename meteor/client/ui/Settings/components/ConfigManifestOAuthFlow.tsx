import * as React from 'react'
import { withTranslation } from 'react-i18next'
import { PeripheralDevice } from '../../../../lib/collections/PeripheralDevices'
import { Translated } from '../../../lib/ReactMeteorData/react-meteor-data'
import { IngestDeviceSettings } from '@sofie-automation/corelib/dist/dataModel/PeripheralDeviceSettings/ingestDevice'
import { NotificationCenter, Notification, NoticeLevel } from '../../../lib/notifications/notifications'
import { fetchFrom } from '../../../lib/lib'

interface IConfigManifestOAuthFlowComponentState {}
interface IConfigManifestOAuthFlowComponentProps {
	device: PeripheralDevice
}
export const ConfigManifestOAuthFlowComponent = withTranslation()(
	class ConfigManifestOAuthFlowComponent extends React.Component<
		Translated<IConfigManifestOAuthFlowComponentProps>,
		IConfigManifestOAuthFlowComponentState
	> {
		constructor(props: Translated<IConfigManifestOAuthFlowComponentProps>) {
			super(props)
			this.state = {}
		}
		onUploadCredentialsFile(e) {
			const { t } = this.props

			const file = e.target.files[0]
			if (!file) {
				return
			}

			const reader = new FileReader()
			reader.onload = (e2) => {
				// On file upload

				this.setState({
					uploadFileKey: Date.now(),
				})

				const uploadFileContents = (e2.target as any).result

				fetchFrom(`/devices/${this.props.device._id}/uploadCredentials`, {
					method: 'POST',
					body: uploadFileContents,
					headers: {
						'content-type': 'text/javascript',
					},
				})
					.then(() => {
						NotificationCenter.push(
							new Notification(
								undefined,
								NoticeLevel.NOTIFICATION,
								t('OAuth credentials succesfully uploaded.'),
								'ConfigManifestOAuthFlowComponent'
							)
						)
					})
					.catch((err) => {
						NotificationCenter.push(
							new Notification(
								undefined,
								NoticeLevel.WARNING,
								t('Failed to upload OAuth credentials: {{errorMessage}}', { errorMessage: err + '' }),
								'ConfigManifestOAuthFlowComponent'
							)
						)
					})
			}
			reader.readAsText(file)
		}

		resetAppCredentials() {
			const { t } = this.props

			fetchFrom(`/devices/${this.props.device._id}/resetAppCredentials`, {
				method: 'POST',
			})
				.then(() => {
					NotificationCenter.push(
						new Notification(
							undefined,
							NoticeLevel.NOTIFICATION,
							t('OAuth credentials successfuly reset'),
							'ConfigManifestOAuthFlowComponent'
						)
					)
				})
				.catch((err) => {
					NotificationCenter.push(
						new Notification(
							undefined,
							NoticeLevel.WARNING,
							t('Failed to reset OAuth credentials: {{errorMessage}}', { errorMessage: err + '' }),
							'ConfigManifestOAuthFlowComponent'
						)
					)
				})
		}

		resetAuth() {
			const { t } = this.props

			fetchFrom(`/devices/${this.props.device._id}/resetAuth`, {
				method: 'POST',
			})
				.then(() => {
					NotificationCenter.push(
						new Notification(
							undefined,
							NoticeLevel.NOTIFICATION,
							t('OAuth credentials successfuly reset'),
							'ConfigManifestOAuthFlowComponent'
						)
					)
				})
				.catch((err) => {
					NotificationCenter.push(
						new Notification(
							undefined,
							NoticeLevel.WARNING,
							t('Failed to reset OAuth credentials: {{errorMessage}}', { errorMessage: err + '' }),
							'ConfigManifestOAuthFlowComponent'
						)
					)
				})
		}

		render() {
			const { t } = this.props
			const settings = (this.props.device.settings || {}) as IngestDeviceSettings
			const device = this.props.device

			return (
				<div>
					{settings.secretAccessToken ? (
						// If this is set, we have completed the authentication procedure.
						// A reset button is provided to begin the flow again if authorization is revoked by the user.
						<div className="mod mvs mhs">
							<button
								className="btn btn-secondary btn-tight"
								onClick={() => this.resetAppCredentials()}
								style={{ marginRight: '10px' }}
							>
								{t('Reset App Credentials')}
							</button>

							<button className="btn btn-secondary btn-tight" onClick={() => this.resetAuth()}>
								{t('Reset User Credentials')}
							</button>
						</div>
					) : (
						<div className="mod mvs mhs">
							{!settings.secretCredentials ? (
								<label className="field">
									<div className="mvs">{t('Application credentials')}</div>
									<div className="mdi">
										<div>{t(device.configManifest.deviceOAuthFlow!.credentialsHelp)}</div>
										<div>
											<a href={device.configManifest.deviceOAuthFlow!.credentialsURL} target="_blank" rel="noreferrer">
												{device.configManifest.deviceOAuthFlow!.credentialsURL}
											</a>
										</div>

										<div className="mdi mvs">
											<input
												type="file"
												accept="application/json,.json"
												onChange={(e) => this.onUploadCredentialsFile(e)}
											/>
											<span className="mdfx"></span>
										</div>
									</div>
								</label>
							) : (
								<label className="field">
									<div>
										<div>{t('Click on the button below and accept the permissions request.')}</div>
										<div className="mvs">
											{device.accessTokenUrl ? (
												<a href={device.accessTokenUrl} target="_blank" rel="noreferrer">
													<button className="btn btn-primary">{t('Authorize App Access')}</button>
												</a>
											) : (
												t('Waiting for gateway to generate URL...')
											)}
										</div>
										<div className="mvs">
											<button className="btn btn-secondary btn-tight" onClick={() => this.resetAppCredentials()}>
												{t('Reset App Credentials')}
											</button>
										</div>
									</div>
								</label>
							)}
						</div>
					)}
				</div>
			)
		}
	}
)
