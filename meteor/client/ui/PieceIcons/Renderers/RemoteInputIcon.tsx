import React from 'react'

export function BaseRemoteInputIcon(props: React.PropsWithChildren<{ className: string }>): JSX.Element {
	return (
		<svg className="piece_icon" version="1.1" viewBox="0 0 126.5 89" xmlns="http://www.w3.org/2000/svg">
			<rect width="126.5" height="89" className={props.className} />
			<text
				x="5"
				y="66.514"
				style={{
					fill: '#ffffff',
					fontFamily: 'open-sans',
					fontSize: '40px',
					letterSpacing: '0px',
					lineHeight: '1.25',
					wordSpacing: '0px',
					textShadow: '0 2px 9px rgba(0, 0, 0, 0.5)',
				}}
				xmlSpace="preserve"
			>
				{props.children}
			</text>
		</svg>
	)
}

export default function RemoteInputIcon(props: { inputIndex?: string; abbreviation?: string }): JSX.Element {
	return (
		<BaseRemoteInputIcon className="remote">
			<tspan
				x={props.inputIndex !== undefined ? '5' : '15'}
				y="66.514"
				style={{ fill: '#ffffff', fontFamily: 'Roboto', fontSize: '62px', fontWeight: 100 }}
				className="label"
			>
				{props.abbreviation ? props.abbreviation : 'LIVE'}
				<tspan style={{ fontFamily: 'Roboto', fontWeight: 'normal' }}>
					{props.inputIndex !== undefined ? props.inputIndex : ''}
				</tspan>
			</tspan>
		</BaseRemoteInputIcon>
	)
}
