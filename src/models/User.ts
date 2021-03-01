import { Config } from "../config/Config";
import Database from "../utilities/Database";
import Utilities from "../utilities/Utilities";

interface IDatabaseUser
{
    id: string,
    first_name: string,
    last_name: string,
    email: string,
    password: string,
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
    password?: string,
}

interface ISerializedUser
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
        public readonly id: string,
        public readonly first_name: string,
        public readonly last_name: string,
        public readonly email: string,
    )
    {}

    public static async create(data: ICreateUser): Promise<User>
    {
        const result = await Database.client.query(
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
        );

        if (result.rowCount === 0)
        {
            throw new Error("Cannot create user");
        }

        return User.deserialize(result.rows[0]);
    }

    public static async retrieve(id: string): Promise<User | null>
    {
        const result = await Database.client.query(
            `
            select *
            from "users"
            where
                "id" = $1
            `,
            [
                id,
            ],
        );

        if (result.rowCount === 0)
        {
            return null;
        }

        return User.deserialize(result.rows[0]);
    }

    public async update(data: IUpdateUser): Promise<void>
    {
        // TODO
    }

    public async delete(): Promise<void>
    {
        // TODO
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

    public static deserialize(data: IDatabaseUser): User
    {
        return new User(
            data.id,
            data.first_name,
            data.last_name,
            data.email,
        );
    }
}
