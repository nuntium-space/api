import Boom from "@hapi/boom";
import { Config } from "../config/Config";
import Database from "../utilities/Database";
import Utilities from "../utilities/Utilities";
import { Bundle } from "./Bundle";

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
}

export class User
{
    private constructor
    (
        private readonly _id: string,
        private _first_name: string,
        private  _last_name: string,
        private _email: string,
        private _password: string,
        private _stripe_customer_id: string | null,
    )
    {}

    public get id(): string
    {
        return this._id;
    }

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
                    Utilities.hash(data.password),
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

    public async update(data: IUpdateUser): Promise<void>
    {
        this._first_name = data.first_name ?? this.first_name;
        this._last_name = data.last_name ?? this.last_name;
        this._email = data.email ?? this.email;

        if (data.old_password)
        {
            if (!Utilities.verifyHash(data.old_password, this._password))
            {
                throw Boom.forbidden(`"old_password" is wrong`);
            }

            this._password = data.new_password
                ? Utilities.hash(data.new_password)
                : this._password;
        }

        await Database.pool
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
            .catch(() =>
            {
                throw Boom.badRequest();
            });
    }

    public async delete(): Promise<void>
    {
        await Database.pool.query(
            `delete from "users" where "id" = $1`,
            [ this.id ],
        );
    }

    public async subscribeToBundle(bundle: Bundle): Promise<void>
    {
        if (!this._stripe_customer_id || !bundle.stripe_price_id)
        {
            throw Boom.badImplementation();
        }

        const client = await Database.pool.connect();

        await client.query("begin");

        await Database.pool
            .query(
                `insert into "users_bundle" ("user", "bundle") values ($1, $2)`,
                [ this.id, bundle.id ],
            )
            .catch(async () =>
            {
                await client.query("rollback");

                throw Boom.badRequest(`Cannot subscribe user '${this.id}' to bundle ${bundle.id}`);
            });

        await Config.STRIPE.subscriptions
            .create({
                customer: this._stripe_customer_id,
                items: [
                    {
                        price: bundle.stripe_price_id,
                    },
                ],
            })
            .catch(async () =>
            {
                await client.query("rollback");

                throw Boom.badRequest();
            });

        await client.query("commit");

        client.release();
    }

    public serialize(): ISerializedUser
    {
        return {
            id: this.id,
            first_name: this.first_name,
            last_name: this.last_name,
            email: this.email,
        };
    }

    private static deserialize(data: IDatabaseUser): User
    {
        return new User(
            data.id,
            data.first_name,
            data.last_name,
            data.email,
            data.password,
            data.stripe_customer_id,
        );
    }
}
