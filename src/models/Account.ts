import Boom from "@hapi/boom";
import { INotExpandedResource } from "../common/INotExpandedResource";
import { ISerializable } from "../common/ISerializable";
import { Config } from "../config/Config";
import Database from "../utilities/Database";
import Utilities from "../utilities/Utilities";
import { ISerializedUser, User } from "./User";

interface IDatabaseAccount
{
    id: string,
    user: string,
    type: string,
    external_id: string,
}

interface ICreateAccount
{
    user: User,
    type: string,
    external_id: string,
}

export interface ISerializedAccount
{
    id: string,
    user: ISerializedUser | INotExpandedResource,
    type: string,
}

export class Account implements ISerializable<ISerializedAccount>
{
    private constructor
    (
        public readonly id: string,
        public readonly user: User | INotExpandedResource,
        public readonly type: string,
        public readonly external_id: string,
    )
    {}

    public static async create(data: ICreateAccount): Promise<Account>
    {
        const result = await Database.pool
            .query(
                `
                insert into "accounts"
                    ("id", "user", "type", "external_id")
                values
                    ($1, $2, $3, $4)
                returning *
                `,
                [
                    Utilities.id(Config.ID_PREFIXES.ACCOUNT),
                    data.user.id,
                    data.type,
                    data.external_id,
                ],
            )
            .catch(() =>
            {
                throw Boom.badRequest();
            });

        return Account.deserialize(result.rows[0]);
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

    public async delete(): Promise<void>
    {
        await Database.pool.query(
            `delete from "accounts" where "id" = $1`,
            [ this.id ],
        );
    }

    public serialize(): ISerializedAccount
    {
        return {
            id: this.id,
            user: this.user instanceof User
                ? this.user.serialize()
                : this.user,
            type: this.type,
        };
    }

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