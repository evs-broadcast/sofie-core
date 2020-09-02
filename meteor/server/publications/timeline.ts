import { Meteor } from 'meteor/meteor'
import { lazyIgnore, unprotectString } from '../../lib/lib'
import {
	Timeline,
	TimelineObjGeneric,
	getRoutedTimeline,
	TimelineObjType,
	TimelineComplete,
} from '../../lib/collections/Timeline'
import { meteorPublish } from './lib'
import { PubSub } from '../../lib/api/pubsub'
import { FindOptions } from '../../lib/typings/meteor'
import { meteorCustomPublishArray } from '../lib/customPublication'
import { PeripheralDeviceId, PeripheralDevices } from '../../lib/collections/PeripheralDevices'
import { Studios, getActiveRoutes, StudioId } from '../../lib/collections/Studios'
import * as _ from 'underscore'
import { PeripheralDeviceReadAccess } from '../security/peripheralDevice'
import { StudioReadAccess } from '../security/studio'

meteorPublish(PubSub.timeline, function(selector, token) {
	if (!selector) throw new Meteor.Error(400, 'selector argument missing')
	const modifier: FindOptions<TimelineObjGeneric> = {
		fields: {},
	}
	if (StudioReadAccess.studioContent(selector, { userId: this.userId, token })) {
		return Timeline.find(selector, modifier)
	}
	return null
})

meteorCustomPublishArray(PubSub.timelineForDevice, 'studioTimeline', function(
	pub,
	deviceId: PeripheralDeviceId,
	token
) {
	if (PeripheralDeviceReadAccess.peripheralDeviceContent({ deviceId: deviceId }, { userId: this.userId, token })) {
		let peripheralDevice = PeripheralDevices.findOne(deviceId)

		if (!peripheralDevice) throw new Meteor.Error('PeripheralDevice "' + deviceId + '" not found')

		const studioId = peripheralDevice.studioId
		if (!studioId) return []

		const observer = setUpPrepareObserver(
			studioId,
			() => {
				const timeline: TimelineComplete | undefined = Timeline.findOne({
					studioId: studioId,
				})
				const studio = Studios.findOne(studioId)
				if (!studio || !timeline) {
					return []
				} else {
					const routes = getActiveRoutes(studio)
					const routedTimeline = getRoutedTimeline(timeline.timeline, routes)

					return [
						{
							_id: timeline._id,
							mappingsHash: studio.mappingsHash,
							timeline: routedTimeline,
						},
					]
				}
			},
			(routedTimeline) => {
				pub.updatedDocs(routedTimeline)
			}
		)

		pub.onStop(() => {
			observer.stop()
		})
	}
})
const callbacks: { [studioId: string]: { stop: Function; callbacks: Function[] } } = {}
function setUpPrepareObserver<T extends any[]>(
	studioId: StudioId,
	prepareData: () => T,
	callback: (preparedData: T) => void
) {
	const sid = unprotectString(studioId)
	if (!callbacks[sid]) {
		const triggerUpdate = () => {
			lazyIgnore(
				`studioTimeline_${studioId}`,
				() => {
					const o = callbacks[sid]
					if (o) {
						const result = prepareData()

						_.each(o.callbacks, (cb) => cb(result))
					}
				},
				3 // ms
			)
		}

		const observeStudio = Studios.find(studioId, {
			fields: {
				// It should be enough to watch the mappingsHash, since that should change whenever there is a
				// change to the mappings or the routes
				mappingsHash: 1,
			},
		}).observeChanges({
			added: triggerUpdate,
			changed: triggerUpdate,
			removed: triggerUpdate,
		})
		const observeTimeline = Timeline.find({
			studioId: studioId,
		}).observeChanges({
			added: triggerUpdate,
			changed: triggerUpdate,
			removed: triggerUpdate,
		})

		callbacks[sid] = {
			stop: () => {
				observeStudio.stop()
				observeTimeline.stop()
			},
			callbacks: [],
		}
	}
	callbacks[sid].callbacks.push(callback)
	return {
		stop: () => {
			const o = callbacks[sid]
			if (o) {
				const i = o.callbacks.indexOf(callback)
				if (i != -1) {
					o.callbacks.splice(i, 1)
				}
				// clean up if empty:
				if (!o.callbacks.length) {
					o.stop()
					delete callbacks[sid]
				}
			}
		},
	}
}
