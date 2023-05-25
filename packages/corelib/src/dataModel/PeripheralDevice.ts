import { Time } from '@sofie-automation/blueprints-integration'
import { DeviceConfigManifest } from '../deviceConfig'
import { OrganizationId, PeripheralDeviceId, StudioId } from './Ids'

import {
	PeripheralDeviceStatusObject,
	PeripheralDeviceCategory,
	PeripheralDeviceType,
	PeripheralDeviceSubType,
	PERIPHERAL_SUBTYPE_PROCESS,
} from '@sofie-automation/shared-lib/dist/peripheralDevice/peripheralDeviceAPI'

export {
	PeripheralDeviceStatusObject,
	PeripheralDeviceCategory,
	PeripheralDeviceType,
	PeripheralDeviceSubType,
	PERIPHERAL_SUBTYPE_PROCESS,
}

import {
	GenericPeripheralDeviceSettings,
	IngestDeviceSecretSettings,
	IngestDeviceSettings,
} from '@sofie-automation/shared-lib/dist/core/model/peripheralDevice'

export interface PeripheralDevice {
	_id: PeripheralDeviceId

	/** Name of the device (set by the device, modifiable by user) */
	name: string

	/** Name of the device (set by the device) */
	deviceName: string

	/** The studio this device is assigned to. Will be undefined for sub-devices */
	studioId?: StudioId

	category: PeripheralDeviceCategory
	type: PeripheralDeviceType
	subType: PeripheralDeviceSubType

	parentDeviceId?: PeripheralDeviceId

	/** When the device was initially created [unix-timestamp] */
	created: number
	status: PeripheralDeviceStatusObject

	settings: IngestDeviceSettings | GenericPeripheralDeviceSettings

	/** If set, this device is owned by that organization */
	organizationId: OrganizationId | null

	/** Versions reported from the device */
	versions?: {
		[libraryName: string]: string
	}
	/** Whether version checks should be disabled for this version */
	disableVersionChecks?: boolean

	lastSeen: Time // Updated continously while connected
	lastConnected: Time // Updated upon connection, not continously

	/** A list of last reported latencies */
	latencies?: number[]

	connected: boolean
	connectionId: string | null // Id of the current ddp-Connection

	token: string

	secretSettings?: IngestDeviceSecretSettings | { [key: string]: any }

	/** If the device is of category ingest, the name of the NRCS being used */
	nrcsName?: string

	documentationUrl?: string

	/** Ignore this device when computing status in the GUI (other status reports are unaffected) */
	ignore?: boolean

	configManifest: DeviceConfigManifest

	/** If this is an ingest gateway, the last tiem data was received */
	lastDataReceived?: Time

	/** If an ingest device performing an oauth flow */
	accessTokenUrl?: string
}

export function getExternalNRCSName(device: PeripheralDevice | undefined): string {
	if (device?.nrcsName && device.category === PeripheralDeviceCategory.INGEST) {
		return device.nrcsName
	} else {
		// undefined NRCS:
		return 'NRCS'
	}
}
