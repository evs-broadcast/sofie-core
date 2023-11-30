import { MetricsGauge } from '@sofie-automation/corelib/dist/prometheus'
import { getSystemStatus } from './systemStatus'

export const healthGauge = new MetricsGauge({
	name: 'sofie_health',
	help: 'Health status of Sofie application and its components',
	labelNames: ['name', 'updated', 'status', 'version', 'statusMessage'] as const,
	async collect() {
		const systemStatus = await getSystemStatus({ userId: null })
		const componentStatus =
			systemStatus.components
				?.filter((c) => c.instanceId !== undefined || c.status !== 'OK')
				.map((c) => {
					const version = c._internal.versions['_process']
					const statusMessage = c.statusMessage ?? c._internal.messages.join(', ')
					return {
						name: c.name,
						updated: c.updated,
						status: c.status,
						version: version,
						statusMessage: statusMessage?.length ? statusMessage : undefined,
					}
				}) ?? []

		const statusMessage = componentStatus
			.filter((c) => c.statusMessage !== undefined)
			.map((c) => `${c.name}: ${c.statusMessage}`)
			.join('; ')

		const statusValues = { OK: 0, FAIL: 1, WARNING: 2, UNDEFINED: 3 }
		this.labels({
			name: systemStatus.name,
			updated: systemStatus.updated,
			status: systemStatus.status,
			version: systemStatus._internal.versions['core'],
			statusMessage: statusMessage.length ? statusMessage : '',
		}).set(statusValues[systemStatus.status])
	},
})
