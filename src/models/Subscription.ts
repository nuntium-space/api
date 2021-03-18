import Boom from "@hapi/boom";
import { INotExpandedResource } from "../common/INotExpandedResource";
import { Config } from "../config/Config";
import Database from "../utilities/Database";
import Utilities from "../utilities/Utilities";
import { Bundle, ISerializedBundle } from "./Bundle";
import { Organization } from "./Organization";
import { ISerializedUser, User } from "./User";

interface IDatabaseSubscription
{
    user: string,
    bundle: string,
    current_period_end: Date | null,
    cancel_at_period_end: boolean,
    stripe_subscription_id: string | null,
}

export interface ICreateSubscription
{
    bundle: string,
}

export interface IUpdateSubscription
{
    current_period_end?: number,
    cancel_at_period_end?: boolean,
}

export interface ISerializedSubscription
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

    public static async create(data: ICreateSubscription, user: User, expand?: string[]): Promise<Subscription>
    {
        const bundle = await Bundle.retrieve(data.bundle, [ "organization" ]);

        if
        (
            !user.stripe_customer_id
            || !bundle.stripe_price_id
            || !(bundle.organization instanceof Organization)
        )
        {
            throw Boom.badImplementation();
        }

        const client = await Database.pool.connect();

        await client.query("begin");

        const result = await client
            .query(
                `
                insert into "subscriptions"
                    ("id", "user", "bundle", "cancel_at_period_end")
                values
                    ($1, $2, $3, $4, $5)
                returning *
                `,
                [
                    Utilities.id(Config.ID_PREFIXES.SUBSCRIPTION),
                    user.id,
                    bundle.id,
                    false,
                ],
            )
            .catch(() =>
            {
                throw Boom.badRequest();
            });

        const subscription = await Config.STRIPE.subscriptions
            .create({
                customer: user.stripe_customer_id,
                items: [
                    {
                        price: bundle.stripe_price_id,
                        quantity: 1,
                    },
                ],
                transfer_data: {
                    amount_percent: 100 - Config.STRIPE_CONNECT_FEE_PERCENT,
                    destination: bundle.organization.stripe_account_id,
                },
                metadata: {
                    user_id: user.id,
                    bundle_id: bundle.id,
                },
            })
            .catch(async () =>
            {
                await client.query("rollback");

                throw Boom.badRequest();
            });

        await client.query("commit");

        client.release();

        return Subscription.deserialize({
            ...result.rows[0],
            current_period_end: new Date(subscription.current_period_end * 1000),
            stripe_subscription_id: subscription.id,
        }, expand);
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
