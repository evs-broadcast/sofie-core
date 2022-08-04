import React, { useEffect } from 'react'
import { NoticeLevel, NotificationCenter, Notification, NotificationAction } from './notifications'
import { getCurrentTime, getRandomString } from '../../../lib/lib'

export interface IProps {
	level?: NoticeLevel
	source?: string
	actions?: NotificationAction[]
	rank?: number
	children?: React.ReactElement<HTMLElement>
}

export function ReactNotification(props: IProps) {
	useEffect(() => {
		const notificationId = getRandomString()
		const notification = new Notification(
			notificationId,
			props.level ?? NoticeLevel.TIP,
			props.children ?? null,
			props.source || 'ReactNotification',
			getCurrentTime(),
			true,
			props.actions,
			props.rank
		)
		NotificationCenter.push(notification)

		return () => {
			NotificationCenter.drop(notificationId)
		}
	}, [props.level, props.source, props.actions, props.rank])

	return null
}
