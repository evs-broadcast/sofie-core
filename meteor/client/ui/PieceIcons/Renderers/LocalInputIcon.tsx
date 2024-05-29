import React from 'react'
import { BaseRemoteInputIcon } from './RemoteInputIcon'

export default function LocalInputIcon(props: { inputIndex?: string; abbreviation?: string }): JSX.Element {
	return (
		<tspan
			x="15"
			y="66.514"
			style={{ fill: '#ffffff', fontFamily: 'Roboto', fontSize: '62px', fontWeight: 100 }}
			className="label"
		>
			<BaseRemoteInputIcon className="local">{props.abbreviation ? props.abbreviation : 'EVS'}</BaseRemoteInputIcon>
		</tspan>
	)
}
