import { Meteor } from 'meteor/meteor'
import '../../../__mocks__/_extendJest'
import { testInFiber } from '../../../__mocks__/helpers/jest'
import { setupDefaultStudioEnvironment, DefaultEnvironment, setupDefaultRundownPlaylist } from '../../../__mocks__/helpers/database'
import { Rundowns, Rundown } from '../../../lib/collections/Rundowns'
import { setMinimumTakeSpan } from '../userActions'
import { RundownPlaylists, RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { UserActionAPI as OriginalUserActionAPI } from '../../../lib/api/userActions'
import { getHash } from '../../../lib/lib'
import { ClientAPI } from '../../../lib/api/client'
import { UserActionsLog } from '../../../lib/collections/UserActionsLog'

require('../client') // include in order to create the Meteor methods needed

namespace UserActionAPI { // Using our own method definition, to catch external API changes
	export enum methods {
		'take' 									= 'userAction.take',
		'setNext' 								= 'userAction.setNext',
		'moveNext' 								= 'userAction.moveNext',

		'prepareForBroadcast' 					= 'userAction.prepareForBroadcast',
		'resetRundown' 							= 'userAction.resetRundown',
		'resetAndActivate' 						= 'userAction.resetAndActivate',
		'forceResetAndActivate' 				= 'userAction.forceResetAndActivate',
		'activate' 								= 'userAction.activate',
		'deactivate' 							= 'userAction.deactivate',
		'reloadData' 							= 'userAction.reloadData',
		'unsyncRundown' 						= 'userAction.unsyncRundown',

		'disableNextPiece'						= 'userAction.disableNextPiece',
		'togglePartArgument'					= 'userAction.togglePartArgument',
		'pieceTakeNow'							= 'userAction.pieceTakeNow',
		'setInOutPoints'						= 'userAction.pieceSetInOutPoints',

		'segmentAdLibPieceStart'				= 'userAction.segmentAdLibPieceStart',
		'sourceLayerOnPartStop'					= 'userAction.sourceLayerOnPartStop',
		'baselineAdLibPieceStart'				= 'userAction.baselineAdLibPieceStart',

		'sourceLayerStickyPieceStart'			= 'userAction.sourceLayerStickyPieceStart',

		'activateHold'							= 'userAction.activateHold',

		'saveEvaluation' 						= 'userAction.saveEvaluation',

		'storeRundownSnapshot'				= 'userAction.storeRundownSnapshot',

		'removeRundown'						= 'userAction.removeRundown',
		'resyncRundown'						= 'userAction.resyncRundown',

		'recordStop'							= 'userAction.recordStop',
		'recordStart'							= 'userAction.recordStart',
		'recordDelete'							= 'userAction.recordDelete',

		'mediaRestartWorkflow'					= 'userAction.mediamanager.restartWorkflow',
		'mediaAbortWorkflow'					= 'userAction.mediamanager.abortWorkflow',
		'mediaRestartAllWorkflows'				= 'userAction.mediamanager.restartAllWorkflows',
		'mediaAbortAllWorkflows'				= 'userAction.mediamanager.abortAllWorkflows',
		'mediaPrioritizeWorkflow'				= 'userAction.mediamanager.mediaPrioritizeWorkflow',

		'regenerateRundown'					= 'userAction.ingest.regenerateRundown',

		'generateRestartToken'				= 'userAction.system.generateRestartToken',
		'restartCore'						= 'userAction.system.restartCore',

		'guiFocused'						= 'guiState.focused',
		'guiBlurred'						= 'guiState.blurred'
	}
}

describe('User Actions', () => {
	let env: DefaultEnvironment
	beforeEach(() => {
		env = setupDefaultStudioEnvironment()
		setMinimumTakeSpan(0)
	})
	testInFiber('Basic rundown control', () => {
		const {
			rundownId: rundownId0,
			playlistId: playlistId0
		} = setupDefaultRundownPlaylist(env)
		const {
			rundownId: rundownId1,
			playlistId: playlistId1
		} = setupDefaultRundownPlaylist(env)
		expect(rundownId0).toBeTruthy()
		expect(rundownId1).toBeTruthy()
		expect(playlistId0).toBeTruthy()
		expect(playlistId1).toBeTruthy()


		const getRundown0 = () => {
			return Rundowns.findOne(rundownId0) as Rundown
		}
		const getPlaylist0 = () => {
			return RundownPlaylists.findOne(playlistId0) as RundownPlaylist
		}
		const getRundown1 = () => {
			return Rundowns.findOne(rundownId1) as Rundown
		}

		expect(getRundown0()).toBeTruthy()
		expect(getPlaylist0()).toBeTruthy()
		expect(getRundown1()).toBeTruthy()
		expect(getRundown0()._id).not.toEqual(getRundown1()._id)

		const parts = getRundown0().getParts()

		expect(getPlaylist0()).toMatchObject({
			active: false,
			rehearsal: false
		})

		{
			// Prepare and activate in rehersal:
			expect(
				Meteor.call(UserActionAPI.methods.prepareForBroadcast, playlistId0)
			).toMatchObject({ success: 200 })

			const { currentPartInstance, nextPartInstance } = getPlaylist0().getSelectedPartInstances()
			expect(currentPartInstance).toBeFalsy()
			expect(nextPartInstance).toBeTruthy()
			expect(nextPartInstance!.part._id).toEqual(parts[0]._id)

			expect(getPlaylist0()).toMatchObject({
				active: true,
				rehearsal: true,
				currentPartInstanceId: null,
				// nextPartInstanceId: parts[0]._id,
			})
		}
		// Activate a second rundown (this should throw an error)
		expect(
			Meteor.call(UserActionAPI.methods.activate, playlistId1, false)
		).toMatchObject({
			error: 409,
			message: expect.stringMatching(/only one rundown/i)
		})


		{
			// Take the first Part:
			expect(
				Meteor.call(UserActionAPI.methods.take, playlistId0)
			).toMatchObject({ success: 200 })

			const { currentPartInstance, nextPartInstance } = getPlaylist0().getSelectedPartInstances()
			expect(currentPartInstance).toBeTruthy()
			expect(nextPartInstance).toBeTruthy()
			expect(currentPartInstance!.part._id).toEqual(parts[0]._id)
			expect(nextPartInstance!.part._id).toEqual(parts[1]._id)
		}

		{
			// Take the second Part:
			expect(
				Meteor.call(UserActionAPI.methods.take, playlistId0)
			).toMatchObject({ success: 200 })

			const { currentPartInstance, nextPartInstance } = getPlaylist0().getSelectedPartInstances()
			expect(currentPartInstance).toBeTruthy()
			expect(nextPartInstance).toBeTruthy()
			expect(currentPartInstance!.part._id).toEqual(parts[1]._id)
			expect(nextPartInstance!.part._id).toEqual(parts[2]._id)
		}

		{
			// Reset rundown:
			expect(
				Meteor.call(UserActionAPI.methods.resetRundown, playlistId0)
			).toMatchObject({ success: 200 })

			const { currentPartInstance, nextPartInstance } = getPlaylist0().getSelectedPartInstances()
			expect(currentPartInstance).toBeFalsy()
			expect(nextPartInstance).toBeTruthy()
			expect(nextPartInstance!.part._id).toEqual(parts[0]._id)

			expect(getPlaylist0()).toMatchObject({
				currentPartInstanceId: null,
				// nextPartInstanceId: parts[0]._id,
			})
		}

		{
			// Set Part as next:
			expect(
				Meteor.call(UserActionAPI.methods.setNext, playlistId0, parts[parts.length - 2]._id)
			).toMatchObject({ success: 200 })

			const { currentPartInstance, nextPartInstance } = getPlaylist0().getSelectedPartInstances()
			expect(currentPartInstance).toBeFalsy()
			expect(nextPartInstance).toBeTruthy()
			expect(nextPartInstance!.part._id).toEqual(parts[parts.length - 2]._id)

			expect(getPlaylist0()).toMatchObject({
				currentPartInstanceId: null,
				// nextPartInstanceId: parts[parts.length - 2]._id,
			})
		}

		{
			// Take the Nexted Part:
			expect(
				Meteor.call(UserActionAPI.methods.take, playlistId0)
			).toMatchObject({ success: 200 })

			const { currentPartInstance, nextPartInstance } = getPlaylist0().getSelectedPartInstances()
			expect(currentPartInstance).toBeTruthy()
			expect(nextPartInstance).toBeTruthy()
			expect(currentPartInstance!.part._id).toEqual(parts[parts.length - 2]._id)
			expect(nextPartInstance!.part._id).toEqual(parts[parts.length - 1]._id)
		}

		console.log('-------------------')
		{
			// Take the last Part:
			expect(
				Meteor.call(UserActionAPI.methods.take, playlistId0)
			).toMatchObject({ success: 200 })
			const { currentPartInstance, nextPartInstance } = getPlaylist0().getSelectedPartInstances()
			expect(currentPartInstance).toBeTruthy()
			expect(nextPartInstance).toBeFalsy()
			expect(currentPartInstance!.part._id).toEqual(parts[parts.length - 1]._id)

			expect(getPlaylist0()).toMatchObject({
				// currentPartInstanceId: parts[parts.length - 1]._id,
				nextPartInstanceId: null
			})
		}

		{
			// Move the next-point backwards:
			expect(
				Meteor.call(UserActionAPI.methods.moveNext, playlistId0, -1, 0)
			).toMatchObject({ success: 200 })

			const { currentPartInstance, nextPartInstance } = getPlaylist0().getSelectedPartInstances()
			expect(currentPartInstance).toBeTruthy()
			expect(nextPartInstance).toBeTruthy()
			expect(currentPartInstance!.part._id).toEqual(parts[parts.length - 1]._id)
			expect(nextPartInstance!.part._id).toEqual(parts[parts.length - 2]._id)
		}

		{
			// Move the next-point backwards:
			expect(
				Meteor.call(UserActionAPI.methods.moveNext, playlistId0, -1, 0)
			).toMatchObject({ success: 200 })

			const { currentPartInstance, nextPartInstance } = getPlaylist0().getSelectedPartInstances()
			expect(currentPartInstance).toBeTruthy()
			expect(nextPartInstance).toBeTruthy()
			expect(currentPartInstance!.part._id).toEqual(parts[parts.length - 1]._id)
			expect(nextPartInstance!.part._id).toEqual(parts[parts.length - 3]._id)
		}

		{
			// Take the nexted Part:
			expect(
				Meteor.call(UserActionAPI.methods.take, playlistId0)
			).toMatchObject({ success: 200 })

			const { currentPartInstance, nextPartInstance } = getPlaylist0().getSelectedPartInstances()
			expect(currentPartInstance).toBeTruthy()
			expect(nextPartInstance).toBeTruthy()
			expect(currentPartInstance!.part._id).toEqual(parts[parts.length - 3]._id)
			expect(nextPartInstance!.part._id).toEqual(parts[parts.length - 2]._id)
		}

		// Deactivate rundown:
		expect(
			Meteor.call(UserActionAPI.methods.deactivate, playlistId0)
		).toMatchObject({ success: 200 })
		expect(getPlaylist0()).toMatchObject({
			active: false,
			currentPartInstanceId: null,
			nextPartInstanceId: null
		})
	})

	testInFiber('Restart Core', () => {
		jest.useFakeTimers()

		// Generate restart token
		const res = Meteor.call(UserActionAPI.methods.generateRestartToken)
		expect(res).toMatchObject({ success: 200 })
		expect(typeof res.result).toBe('string')

		const mockExit = jest.spyOn(process, 'exit').mockImplementation()

		// Use an invalid token to try and restart it
		try {
			Meteor.call(UserActionAPI.methods.restartCore, 'invalidToken')
			// calling this method with an invalid token should throw
			expect(false).toBeTruthy()
		} catch (e) {
			expect(true).toBeTruthy()
		}

		expect(
			Meteor.call(UserActionAPI.methods.restartCore, getHash(OriginalUserActionAPI.RESTART_SALT + res.result))
		).toMatchObject({ success: 200 })

		jest.runAllTimers()

		expect(mockExit).toHaveBeenCalledTimes(1)
	})

	testInFiber('GUI Status', () => {
		expect(
			Meteor.call(ClientAPI.methods.execMethod, 'mousedown', UserActionAPI.methods.guiFocused, [ 'dummyClientData' ])
		).toMatchObject({ success: 200 })
		const logs0 = UserActionsLog.find({
			method: UserActionAPI.methods.guiFocused,
		}).fetch()
		expect(logs0).toHaveLength(1)
		expect(logs0[0]).toMatchObject({
			context: 'mousedown',
			args: JSON.stringify([ [ 'dummyClientData' ] ])
		})

		expect(
			Meteor.call(ClientAPI.methods.execMethod, 'interval', UserActionAPI.methods.guiBlurred, [ 'dummyClientData' ])
		).toMatchObject({ success: 200 })
		const logs1 = UserActionsLog.find({
			method: UserActionAPI.methods.guiBlurred
		}).fetch()
		expect(logs1).toHaveLength(1)
		expect(logs1[0]).toMatchObject({
			context: 'interval',
			args: JSON.stringify([ [ 'dummyClientData' ] ])
		})
	})
})
