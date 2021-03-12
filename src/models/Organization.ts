import { Config } from "../config/Config";
import Database from "../utilities/Database";
import Utilities from "../utilities/Utilities";
import { ISerializedUser, User } from "./User";

interface IDatabaseOrganization
{
    id: string,
    name: string,
    user: string,
}

interface ICreateOrganization
{
    name: string,
}

interface IUpdateOrganization
{
    name?: string,
}

export interface ISerializedOrganization
{
    id: string,
    name: string,
    owner: ISerializedUser,
}

export class Organization
{
    private constructor
    (
        private readonly _id: string,
        private _name: string,
        private  _owner: User,
    )
    {}

    public get id(): string
    {
        return this._id;
    }

    public get name(): string
    {
        return this._name;
    }

    public get owner(): User
    {
        return this._owner;
    }

    public static async create(data: ICreateOrganization, user: User): Promise<Organization>
    {
        const result = await Database.pool.query(
            `
            insert into "organizations"
                ("id", "name", "user")
            values
                ($1, $2, $3)
            returning *
            `,
            [
                Utilities.id(Config.ID_PREFIXES.ORGANIZATION),
                data.name,
                user.id,
            ],
        );

        if (result.rowCount === 0)
        {
            throw new Error("Cannot create organization");
        }

        return Organization.deserialize(result.rows[0]);
    }

    public static async retrieve(id: string): Promise<Organization | null>
    {
        const result = await Database.pool.query(
            `select * from "organizations" where "id" = $1`,
            [ id ],
        );

        if (result.rowCount === 0)
        {
            return null;
        }

        return Organization.deserialize(result.rows[0]);
    }

    public async update(data: IUpdateOrganization): Promise<void>
    {
        this._name = data.name ?? this.name;

        const result = await Database.pool.query(
            `
            update "organizations"
            set
                "name" = $1
            where
                "id" = $2
            `,
            [
                this.name,
                this.id,
            ],
        );

        if (result.rowCount === 0)
        {
            throw new Error("Cannot update organization");
        }
    }

    public async delete(): Promise<void>
    {
        const result = await Database.pool.query(
            `delete from "organizations" where "id" = $1`,
            [ this.id ],
        );

        if (result.rowCount === 0)
        {
            throw new Error("Cannot delete organization");
        }
    }

    public static async forUser(user: User): Promise<Organization[]>
    {
        const result = await Database.pool.query(
            `select * from "organizations" where "user" = $1`,
            [ user.id ],
        );

        return Promise.all(result.rows.map(Organization.deserialize));
    }

    public serialize(): ISerializedOrganization
    {
        return {
            id: this.id,
            name: this.name,
            owner: this.owner.serialize(),
        };
    }

    private static async deserialize(data: IDatabaseOrganization): Promise<Organization>
    {
        const owner = await User.retrieve(data.user);

        if (!owner)
        {
            throw new Error(`The user '${data.user}' does not exist`);
        }

        return new Organization(
            data.id,
            data.name,
            owner,
        );
    }
}
