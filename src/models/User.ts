import Boom from "@hapi/boom";
import { INotExpandedResource } from "../common/INotExpandedResource";
import { ISerializable } from "../common/ISerializable";
import { Config } from "../config/Config";
import Database from "../utilities/Database";
import Utilities from "../utilities/Utilities";
import { Bundle } from "./Bundle";
import { PaymentMethod } from "./PaymentMethod";
import { Publisher } from "./Publisher";

interface IDatabaseUser
{
    id: string,
    username: string | null,
    email: string,
    stripe_customer_id: string | null,
}

interface ICreateUser
{
    username?: string,
    email: string,
}

interface IUpdateUser
{
    username?: string,
    email?: string,
}

interface IUserSettings
{
    language: string | null,
}

interface IUpdateUserSettings
{
    language?: string,
}

export interface ISerializedUser
{
    id: string,
    username: string | null,
    email: string,
    has_default_payment_method: boolean,
}

export class User implements ISerializable<ISerializedUser>
{
    private constructor
    (
        public readonly id: string,
        private _username: string | null,
        private _email: string,
        public readonly default_payment_method: PaymentMethod | null,
        public readonly stripe_customer_id: string | null,
    )
    {}

    public get username(): string | null
    {
        return this._username;
    }

    public get email(): string
    {
        return this._email;
    }

    public static async create(data: ICreateUser): Promise<User>
    {
        const client = await Database.pool.connect();

        await client.query("begin");

        const result = await client
            .query(
                `
                insert into "users"
                    ("id", "username", "email")
                values
                    ($1, $2, $3)
                returning *
                `,
                [
                    Utilities.id(Config.ID_PREFIXES.USER),
                    data.username ?? null,
                    data.email,
                ],
            )
            .catch(async () =>
            {
                await client.query("rollback");

                throw Boom.badRequest();
            });

        await Config.STRIPE.customers
            .create({
                email: data.email,
                metadata: {
                    user_id: result.rows[0].id,
                },
            })
            .catch(async () =>
            {
                await client.query("rollback");

                throw Boom.badRequest();
            });

        await client.query("commit");

        client.release();

        return User.deserialize(result.rows[0]);
    }

    public static async retrieve(id: string): Promise<User>
    {
        const result = await Database.pool.query(
            `select * from "users" where "id" = $1`,
            [ id ],
        );

        if (result.rowCount === 0)
        {
            throw Boom.notFound();
        }

        return User.deserialize(result.rows[0]);
    }

    public static async retrieveWithEmail(email: string): Promise<User>
    {
        const result = await Database.pool.query(
            `select * from "users" where "email" = $1`,
            [ email ],
        );

        if (result.rowCount === 0)
        {
            throw Boom.notFound();
        }

        return User.deserialize(result.rows[0]);
    }

    public static async retrieveWithCustomerId(customerId: string): Promise<User>
    {
        const result = await Database.pool.query(
            `select * from "users" where "stripe_customer_id" = $1`,
            [ customerId ],
        );

        if (result.rowCount === 0)
        {
            throw Boom.notFound();
        }

        return User.deserialize(result.rows[0]);
    }

    public static async exists(email: string): Promise<boolean>
    {
        const { rowCount } = await Database.pool.query(
            `select count(*) from "users" where "email" = $1 limit 1`,
            [ email ],
        );

        return rowCount > 0;
    }

    public async update(data: IUpdateUser): Promise<void>
    {
        this._username = data.username ?? this.username;
        this._email = data.email ?? this.email;

        const client = await Database.pool.connect();

        await client.query("begin");

        await client
            .query(
                `
                update "users"
                set
                    "username" = $1,
                    "email" = $2
                where
                    "id" = $3
                `,
                [
                    this.username,
                    this.email,
                    this.id,
                ],
            )
            .catch(async () =>
            {
                await client.query("rollback");

                throw Boom.badRequest();
            });

        if (this.stripe_customer_id)
        {
            await Config.STRIPE.customers
                .update(this.stripe_customer_id, {
                    email: this.email,
                })
                .catch(async () =>
                {
                    await client.query("rollback");

                    throw Boom.badRequest();
                });
        }

        await client.query("commit");

        client.release();
    }

    public async delete(): Promise<void>
    {
        if (!await this.canBeDeleted())
        {
            throw Boom.forbidden(undefined, [
                {
                    field: "user",
                    error: `Cannot delete user '${this.id}'`,
                },
            ]);
        }

        const client = await Database.pool.connect();

        await client.query("begin");

        await client.query(
            `delete from "users" where "id" = $1`,
            [ this.id ],
        );

        if (this.stripe_customer_id)
        {
            await Config.STRIPE.customers
                .del(this.stripe_customer_id)
                .catch(async () =>
                {
                    await client.query("rollback");

                    throw Boom.badRequest();
                });
        }

        await client.query("commit");

        client.release();
    }

    public async removeDefaultPaymentMethod(): Promise<void>
    {
        await Database.pool
            .query(
                `delete from "default_payment_methods" where "user" = $1`,
                [ this.id ],
            )
            .catch(() =>
            {
                throw Boom.badImplementation();
            });
    }

    public async setDefaultPaymentMethod(stripePaymentMethodId: string): Promise<void>
    {
        const paymentMethod = await PaymentMethod.retrieveWithStripeId(stripePaymentMethodId);

        await this.removeDefaultPaymentMethod();

        await Database.pool
            .query(
                `insert into "default_payment_methods" ("user", "payment_method") values ($1, $2)`,
                [ this.id, paymentMethod.id ],
            )
            .catch(() =>
            {
                throw Boom.badImplementation();
            });
    }

    public async retrieveSettings(): Promise<IUserSettings>
    {
        const { rows: [ row ] } = await Database.pool
            .query(
                `
                select "language"
                from "user_settings"
                where "user" = $1
                `,
                [ this.id ],
            )
            .catch(() =>
            {
                throw Boom.badImplementation();
            });

        return {
            language: row?.language ?? null,
        };
    }

    public async hasSettings(): Promise<boolean>
    {
        const { rowCount } = await Database.pool
            .query(
                `
                select "user"
                from "user_settings"
                where "user" = $1
                limit 1
                `,
                [ this.id ],
            )
            .catch(() =>
            {
                throw Boom.badImplementation();
            });

        return rowCount > 0;
    }

    public async updateSettings(data: IUpdateUserSettings): Promise<void>
    {
        const settings = await this.retrieveSettings();

        settings.language = data.language ?? settings.language;

        if (!Config.LANGUAGES.find(l => l.id === settings.language))
        {
            throw Boom.badData(undefined, [
                {
                    field: "language",
                    error: `Unsupported language: '${data.language}'`,
                },
            ]);
        }

        const hasSettings = await this.hasSettings();

        const client = await Database.pool.connect();

        await client.query("begin");

        const query = hasSettings
            ?
                `
                update "user_settings"
                set
                    "language" = $1
                where
                    "user" = $2
                `
            :
                `
                insert into "user_settings"
                    ("user", "language")
                values
                    ($1, $2)
                `;
        
        const params = hasSettings
            ? [ settings.language, this.id ]
            : [ this.id, settings.language ];

        await client
            .query(query, params)
            .catch(async () =>
            {
                await client.query("rollback");

                throw Boom.badImplementation();
            });

        if (this.stripe_customer_id && settings.language)
        {
            await Config.STRIPE.customers
                .update(this.stripe_customer_id, {
                    preferred_locales: [ settings.language ],
                })
                .catch(async () =>
                {
                    await client.query("rollback");

                    throw Boom.badRequest();
                });
        }

        await client.query("commit");

        client.release();
    }

    public async canBeDeleted(): Promise<boolean>
    {
        const authorCountResult = await Database.pool
            .query(
                `
                select count(*) as "count"
                from "authors"
                where "user" = $1
                `,
                [ this.id ],
            );

        if (authorCountResult.rows[0].count > 0)
        {
            return false;
        }

        const authorCountForOwnedPublishersResult = await Database.pool
            .query(
                `
                select count(*) as "count"
                from
                    "publishers" as "p"
                    inner join
                    "organizations" as "o"
                    on "p"."organization" = "o"."id"
                    inner join
                    "authors" as "a"
                    on "a"."publisher" = "p"."id"
                where "o"."user" = $1
                `,
                [ this.id ],
            );

        return authorCountForOwnedPublishersResult.rows[0].count === BigInt(0);
    }

    public async canSubscribeToBundle(bundle: Bundle): Promise<boolean>
    {
        const result = await Database.pool
            .query(
                `
                select count(*) as "count"
                from
                    "subscriptions" as s
                    inner join
                    "prices" as p
                    on s.price = p.id
                where
                    "s"."deleted" = false
                    and
                    "s"."user" = $1
                    and
                    "p"."bundle" = $2
                `,
                [ this.id, bundle.id ],
            );

        return result.rows[0].count === BigInt(0);
    }

    public async isAuthorOfPublisher(publisher: Publisher): Promise<boolean>
    {
        const result = await Database.pool
            .query(
                `
                select count(*) as "count"
                from "authors"
                where
                    "user" = $1
                    and
                    "publisher" = $2
                `,
                [ this.id, publisher.id ],
            );

        return result.rows[0].count > 0;
    }

    public async isSubscribedToPublisher(publisher: Publisher): Promise<boolean>
    {
        /**
         * The owner of the publisher is considered subscribed to it
         */
        if (publisher.isOwnedByUser(this))
        {
            return true;
        }

        const result = await Database.pool
            .query(
                `
                select count(*) as "count"
                from
                    "v_active_subscriptions" as s
                    inner join
                    "prices" as p
                    on s.price = p.id
                    inner join
                    "bundles_publishers" as bp
                    on p.bundle = bp.bundle
                where
                    "user" = $1
                    and
                    "publisher" = $2
                `,
                [ this.id, publisher.id ],
            );

        return result.rows[0].count > 0;
    }

    public async hasActiveSubscriptions(): Promise<boolean>
    {
        const result = await Database.pool
            .query(
                `
                select count(*) as "count"
                from "v_active_subscriptions"
                where "user" = $1
                `,
                [ this.id ],
            );

        return result.rows[0].count > 0;
    }

    public serialize(options?: {
        /**
         * The authenticated user (or just its ID) that requested this user's data
         * 
         * This param is used to remove sensitive information from
         * the response if the authenticated user does not match
         * the user that will be serialized
         */
        for?: User | INotExpandedResource,
    }): ISerializedUser
    {
        let response: any = {
            id: this.id,
            username: this.username,
        };

        if (options?.for?.id === this.id)
        {
            response = {
                ...response,
                email: this.email,
                has_default_payment_method: this.default_payment_method !== null
            };
        }

        return response;
    }

    private static async deserialize(data: IDatabaseUser): Promise<User>
    {
        const paymentMethod = await PaymentMethod.retrieveDefaultForUser(data.id);

        return new User(
            data.id,
            data.username,
            data.email,
            paymentMethod,
            data.stripe_customer_id,
        );
    }
}
