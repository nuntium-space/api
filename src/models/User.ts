import Boom from "@hapi/boom";
import { Config } from "../config/Config";
import Database from "../utilities/Database";
import Utilities from "../utilities/Utilities";
import { Bundle } from "./Bundle";
import { PaymentMethod } from "./PaymentMethod";
import { Publisher } from "./Publisher";

interface IDatabaseUser
{
    id: string,
    first_name: string,
    last_name: string,
    email: string,
    password: string,
    stripe_customer_id: string | null,
}

interface ICreateUser
{
    first_name: string,
    last_name: string,
    email: string,
    password: string,
}

interface IUpdateUser
{
    first_name?: string,
    last_name?: string,
    email?: string,
    new_password?: string,
    old_password?: string,
}

export interface ISerializedUser
{
    id: string,
    first_name: string,
    last_name: string,
    email: string,
    has_default_payment_method: boolean,
}

export class User
{
    private constructor
    (
        public readonly id: string,
        private _first_name: string,
        private _last_name: string,
        private _email: string,
        private _password: string,
        public readonly default_payment_method: PaymentMethod | null,
        public readonly stripe_customer_id: string | null,
    )
    {}

    public get first_name(): string
    {
        return this._first_name;
    }

    public get last_name(): string
    {
        return this._last_name;
    }

    public get email(): string
    {
        return this._email;
    }

    public get password(): string
    {
        return this._password;
    }

    public static async create(data: ICreateUser): Promise<User>
    {
        const client = await Database.pool.connect();

        await client.query("begin");

        const result = await client
            .query(
                `
                insert into "users"
                    ("id", "first_name", "last_name", "email", "password")
                values
                    ($1, $2, $3, $4, $5)
                returning *
                `,
                [
                    Utilities.id(Config.ID_PREFIXES.USER),
                    data.first_name,
                    data.last_name,
                    data.email,
                    await Utilities.hash(data.password),
                ],
            )
            .catch(async () =>
            {
                await client.query("rollback");

                throw Boom.badRequest();
            });

        await Config.STRIPE.customers
            .create({
                name: `${data.first_name} ${data.last_name}`,
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

    public async update(data: IUpdateUser): Promise<void>
    {
        this._first_name = data.first_name ?? this.first_name;
        this._last_name = data.last_name ?? this.last_name;
        this._email = data.email ?? this.email;

        if (data.old_password)
        {
            if (!await Utilities.verifyHash(data.old_password, this._password))
            {
                throw Boom.forbidden(`"old_password" is wrong`);
            }

            this._password = data.new_password
                ? await Utilities.hash(data.new_password)
                : this._password;
        }

        const client = await Database.pool.connect();

        await client.query("begin");

        await client
            .query(
                `
                update "users"
                set
                    "first_name" = $1,
                    "last_name" = $2,
                    "email" = $3,
                    "password" = $4
                where
                    "id" = $5
                `,
                [
                    this.first_name,
                    this.last_name,
                    this.email,
                    this._password,
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
                    name: `${this.first_name} ${this.last_name}`,
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
            throw Boom.forbidden(`Cannot delete user '${this.id}'`);
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

    public serialize(): ISerializedUser
    {
        return {
            id: this.id,
            first_name: this.first_name,
            last_name: this.last_name,
            email: this.email,
            has_default_payment_method: this.default_payment_method !== null,
        };
    }

    private static async deserialize(data: IDatabaseUser): Promise<User>
    {
        const paymentMethod = await PaymentMethod.retrieveDefaultForUser(data.id);

        return new User(
            data.id,
            data.first_name,
            data.last_name,
            data.email,
            data.password,
            paymentMethod,
            data.stripe_customer_id,
        );
    }
}
