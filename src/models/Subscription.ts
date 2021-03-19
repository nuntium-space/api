import Boom from "@hapi/boom";
import { INotExpandedResource } from "../common/INotExpandedResource";
import Database from "../utilities/Database";
import { Bundle, ISerializedBundle } from "./Bundle";
import { ISerializedUser, User } from "./User";

interface IDatabaseSubscription
{
    user: string,
    bundle: string,
    current_period_end: Date | null,
    cancel_at_period_end: boolean,
    stripe_subscription_id: string | null,
}

interface IUpdateSubscription
{
    current_period_end?: number,
    cancel_at_period_end?: boolean,
}

interface ISerializedSubscription
{
    user: ISerializedUser | INotExpandedResource,
    bundle: ISerializedBundle | INotExpandedResource,
    current_period_end: string | null,
    cancel_at_period_end: boolean,
}

export class Subscription
{
    private constructor
    (
        private readonly _user: User | INotExpandedResource,
        private readonly _bundle: Bundle | INotExpandedResource,
        private _current_period_end: Date | null,
        private _cancel_at_period_end: boolean,
        private readonly _stripe_subscription_id: string | null,
    )
    {}

    public get user(): User | INotExpandedResource
    {
        return this._user;
    }

    public get bundle(): Bundle | INotExpandedResource
    {
        return this._bundle;
    }

    public get current_period_end(): Date | null
    {
        return this._current_period_end;
    }

    public get cancel_at_period_end(): boolean
    {
        return this._cancel_at_period_end;
    }

    public get stripe_subscription_id(): string | null
    {
        return this._stripe_subscription_id;
    }

    public static async retrieveWithSubscriptionId(subscriptionId: string): Promise<Subscription>
    {
        const result = await Database.pool.query(
            `select * from "subscriptions" where "stripe_subscription_id" = $1`,
            [ subscriptionId ],
        );

        if (result.rowCount === 0)
        {
            throw Boom.notFound();
        }

        return Subscription.deserialize(result.rows[0]);
    }

    public async update(data: IUpdateSubscription): Promise<void>
    {
        this._current_period_end = data.current_period_end
            ? new Date(data.current_period_end * 1000)
            : this.current_period_end;
        this._cancel_at_period_end = data.cancel_at_period_end ?? this.cancel_at_period_end;

        await Database.pool
            .query(
                `
                update "subscriptions"
                set
                    "current_period_end" = $1,
                    "cancel_at_period_end" = $2
                where
                    "stripe_subscription_id" = $3
                `,
                [
                    this.current_period_end,
                    this.cancel_at_period_end,
                    this.stripe_subscription_id,
                ],
            )
            .catch(() =>
            {
                throw Boom.badRequest();
            });
    }

    public async delete(): Promise<void>
    {
        await Database.pool.query(
            `delete from "subscriptions" where "stripe_subscription_id" = $1`,
            [ this.stripe_subscription_id ],
        );
    }

    public static async forUser(user: User, expand?: string[]): Promise<Subscription[]>
    {
        const result = await Database.pool.query(
            `select * from "subscriptions" where "user" = $1`,
            [ user.id ],
        );

        return Promise.all(result.rows.map(row => Subscription.deserialize(row, expand)));
    }

    public serialize(): ISerializedSubscription
    {
        return {
            user: this.user instanceof User
                ? this.user.serialize()
                : this.user,
            bundle: this.bundle instanceof Bundle
                ? this.bundle.serialize()
                : this.bundle,
            current_period_end: this.current_period_end?.toISOString() ?? null,
            cancel_at_period_end: this.cancel_at_period_end,
        };
    }

    private static async deserialize(data: IDatabaseSubscription, expand?: string[]): Promise<Subscription>
    {
        const user = expand?.includes("user")
            ? await User.retrieve(data.user)
            : { id: data.user };

        const bundle = expand?.includes("bundle")
            ? await Bundle.retrieve(data.bundle, expand.filter(e => e.startsWith("bundle.")).map(e => e.replace("bundle.", "")))
            : { id: data.bundle };

        return new Subscription(
            user,
            bundle,
            data.current_period_end,
            data.cancel_at_period_end,
            data.stripe_subscription_id,
        );
    }
}
