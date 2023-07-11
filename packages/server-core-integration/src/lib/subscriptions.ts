import { ProtectedString, protectString, unprotectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import type { DDPConnector } from './ddpConnector'

export type SubscriptionId = ProtectedString<'SubscriptionId'>

export class SubscriptionsHelper {
	readonly #ddp: DDPConnector
	readonly #deviceToken: string

	readonly #autoSubscriptions = new Map<
		SubscriptionId,
		{
			publicationName: string
			params: Array<any>
		}
	>()
	readonly #otherSubscriptions = new Set<SubscriptionId>()

	constructor(private readonly emitError: (err: string) => void, ddp: DDPConnector, deviceToken: string) {
		this.#ddp = ddp
		this.#deviceToken = deviceToken
	}

	public async subscribeOnce(publicationName: string, ...params: Array<any>): Promise<SubscriptionId> {
		const subscriptionId = await this.subscribeWithId(undefined, publicationName, ...params)
		this.#otherSubscriptions.add(subscriptionId)
		return subscriptionId
	}

	private async subscribeWithId(
		existingSubscriptionId: string | undefined,
		publicationName: string,
		...params: Array<any>
	): Promise<SubscriptionId> {
		return new Promise((resolve, reject) => {
			if (!this.#ddp.ddpClient) {
				reject('subscribe: DDP client is not initialized')
				return
			}
			try {
				const subscriptionId = this.#ddp.ddpClient.subscribe(
					publicationName, // name of Meteor Publish function to subscribe to
					params.concat([this.#deviceToken]), // parameters used by the Publish function
					() => {
						// TODO - I think this callback has an error parameter?

						// callback when the subscription is complete
						resolve(protectString(subscriptionId))
					},
					existingSubscriptionId
				)
			} catch (e) {
				reject(e)
			}
		})
	}

	async autoSubscribe(publicationName: string, ...params: Array<any>): Promise<SubscriptionId> {
		const subscriptionId = await this.subscribeOnce(publicationName, ...params)
		this.#autoSubscriptions.set(subscriptionId, {
			publicationName: publicationName,
			params: params,
		})
		return subscriptionId
	}

	public unsubscribe(subscriptionId: SubscriptionId): void {
		this.#ddp.ddpClient?.unsubscribe(unprotectString(subscriptionId))
		this.#autoSubscriptions.delete(subscriptionId)
		this.#otherSubscriptions.delete(subscriptionId)
	}

	public renewAutoSubscriptions(): void {
		// Forget the other presumed dead subscriptions
		this.#otherSubscriptions.clear()

		for (const [subId, sub] of this.#autoSubscriptions.entries()) {
			this.subscribeWithId(unprotectString(subId), sub.publicationName, ...sub.params).catch((e) =>
				this.emitError('renewSubscr ' + sub.publicationName + ': ' + e)
			)
		}
	}

	public unsubscribeAll(): void {
		for (const subId of this.#otherSubscriptions) {
			this.unsubscribe(subId)
		}
		this.#otherSubscriptions.clear()

		for (const subId of this.#autoSubscriptions.keys()) {
			this.unsubscribe(subId)
		}
		this.#autoSubscriptions.clear()
	}
}
