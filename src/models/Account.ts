import Boom from "@hapi/boom";
import { INotExpandedResource } from "../common/INotExpandedResource";
import { Config } from "../config/Config";
import { ICreateAccount, IDatabaseAccount } from "../types/account";
import Database from "../utilities/Database";
import Utilities from "../utilities/Utilities";
import { User } from "./User";

export class Account
{
    private constructor
    (
        public readonly id: string,
        public readonly user: User | INotExpandedResource,
        public readonly type: string,
        public readonly external_id: string,
    )
    {}

    //////////
    // CRUD //
    //////////

    public static async create(data: ICreateAccount): Promise<INotExpandedResource>
    {
        const id = Utilities.id(Config.ID_PREFIXES.ACCOUNT);

        await Database.pool
            .query(
                `
                insert into "accounts"
                    ("id", "user", "type", "external_id")
                values
                    ($1, $2, $3, $4)
                returning *
                `,
                [
                    id,
                    typeof data.user === "string"
                        ? data.user
                        : data.user.id,
                    data.type,
                    data.external_id,
                ],
            )
            .catch(() =>
            {
                throw Boom.badRequest();
            });

        return { id };
    }

    public static async retrieve(id: string): Promise<Account>
    {
        const result = await Database.pool.query(
            `select * from "accounts" where "id" = $1`,
            [ id ],
        );

        if (result.rowCount === 0)
        {
            throw Boom.notFound();
        }

        return Account.deserialize(result.rows[0]);
    }

    public static async retrieveWithUserAndType(user: User | INotExpandedResource | string, type: string): Promise<Account>
    {
        const result = await Database.pool.query(
            `
            select *
            from "accounts"
            where
                "user" = $1
                and
                "type" = $2
            `,
            [
                typeof user === "string"
                    ? user
                    : user.id,
                type,
            ],
        );

        if (result.rowCount === 0)
        {
            throw Boom.notFound();
        }

        return Account.deserialize(result.rows[0]);
    }

    public static async retrieveWithExternalId(id: string): Promise<Account>
    {
        const result = await Database.pool.query(
            `select * from "accounts" where "external_id" = $1`,
            [ id ],
        );

        if (result.rowCount === 0)
        {
            throw Boom.notFound();
        }

        return Account.deserialize(result.rows[0]);
    }

    public async delete(): Promise<void>
    {
        await Database.pool.query(
            `delete from "accounts" where "id" = $1`,
            [ this.id ],
        );
    }

    ///////////////
    // UTILITIES //
    ///////////////

    public static async exists(user: User | INotExpandedResource | string, type: string): Promise<boolean>
    {
        const result = await Database.pool.query(
            `
            select 1
            from "accounts"
            where
                "user" = $1
                and
                "type" = $2
            limit 1
            `,
            [
                typeof user === "string"
                    ? user
                    : user.id,
                type,
            ],
        );

        return result.rows.length > 0;
    }

    public static async existsWithExternalId(id: string): Promise<boolean>
    {
        const result = await Database.pool.query(
            `
            select 1
            from "accounts"
            where "external_id" = $1
            limit 1
            `,
            [ id ],
        );

        return result.rows.length > 0;
    }

    public static async forUser(user: User | INotExpandedResource | string, expand?: string[]): Promise<Account[]>
    {
        const result = await Database.pool.query(
            `
            select *
            from "accounts"
            where "user" = $1
            `,
            [
                typeof user === "string"
                    ? user
                    : user.id,
            ],
        );

        return Promise.all(result.rows.map(_ => Account.deserialize(_, expand)));
    }

    ///////////////////
    // SERIALIZATION //
    ///////////////////

    private static async deserialize(data: IDatabaseAccount, expand?: string[]): Promise<Account>
    {
        const user = expand?.includes("user")
            ? await User.retrieve(data.user)
            : { id: data.user };

        return new Account(
            data.id,
            user,
            data.type,
            data.external_id,
        );
    }
}
