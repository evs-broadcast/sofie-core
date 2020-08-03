import { Meteor } from 'meteor/meteor'

import { RundownSecurity } from '../security/rundowns'
import {
	RundownBaselineAdLibActions,
	RundownBaselineAdLibAction,
} from '../../lib/collections/RundownBaselineAdLibActions'
import { meteorPublish } from './lib'
import { PubSub } from '../../lib/api/pubsub'
import { FindOptions } from '../../lib/typings/meteor'

meteorPublish(PubSub.rundownBaselineAdLibActions, function(selector, token) {
	if (!selector) throw new Meteor.Error(400, 'selector argument missing')
	const modifier: FindOptions<RundownBaselineAdLibAction> = {
		fields: {},
	}
	if (RundownSecurity.allowReadAccess(selector, token, this)) {
		return RundownBaselineAdLibActions.find(selector, modifier)
	}
	return null
})
