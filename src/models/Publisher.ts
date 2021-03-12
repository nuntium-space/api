import { Config } from "../config/Config";
import Database from "../utilities/Database";
import Utilities from "../utilities/Utilities";
import { ISerializedOrganization, Organization } from "./Organization";
import { User } from "./User";

interface IDatabasePublisher
{
    id: string,
    name: string,
    url: string,
    organization: string,
}

interface ICreatePublisher
{
    name: string,
    url: string,
    organization: string,
}

interface IUpdatePublisher
{
    name?: string,
    url?: string,
}

export interface ISerializedPublisher
{
    id: string,
    name: string,
    url: string,
    organization: ISerializedOrganization,
}

export class Publisher
{
    private constructor
    (
        private readonly _id: string,
        private _name: string,
        private _url: string,
        private  _organization: Organization,
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

    public get url(): string
    {
        return this._url;
    }

    public get organization(): Organization
    {
        return this._organization;
    }

    public static async create(data: ICreatePublisher): Promise<Publisher>
    {
        const client = await Database.pool.connect();

        const result = await client.query(
            `
            insert into "publishers"
                ("id", "name", "url", "organization")
            values
                ($1, $2, $3, $4)
            returning *
            `,
            [
                Utilities.id(Config.ID_PREFIXES.PUBLISHER),
                data.name,
                data.url,
                data.organization,
            ],
        );

        if (result.rowCount === 0)
        {
            throw new Error("Cannot create publisher");
        }

        return Publisher.deserialize(result.rows[0]);
    }

    public static async retrieve(id: string): Promise<Publisher | null>
    {
        const client = await Database.pool.connect();

        const result = await client.query(
            `select * from "publishers" where "id" = $1`,
            [ id ],
        );

        if (result.rowCount === 0)
        {
            return null;
        }

        return Publisher.deserialize(result.rows[0]);
    }

    public async update(data: IUpdatePublisher): Promise<void>
    {
        this._name = data.name ?? this.name;
        this._url = data.url ?? this.url;

        const client = await Database.pool.connect();

        const result = await client.query(
            `
            update "publishers"
            set
                "name" = $1,
                "url" = $2
            where
                "id" = $3
            `,
            [
                this.name,
                this.url,
                this.id,
            ],
        );

        if (result.rowCount === 0)
        {
            throw new Error("Cannot update publisher");
        }
    }

    public async delete(): Promise<void>
    {
        const client = await Database.pool.connect();

        const result = await client.query(
            `delete from "publishers" where "id" = $1`,
            [ this.id ],
        );

        if (result.rowCount === 0)
        {
            throw new Error("Cannot delete publisher");
        }
    }

    public static async forOrganization(organization: Organization): Promise<Publisher[]>
    {
        const client = await Database.pool.connect();

        const result = await client.query(
            `select * from "publishers" where "organization" = $1`,
            [ organization.id ],
        );

        return Promise.all(result.rows.map(Publisher.deserialize));
    }

    public static async forUser(user: User): Promise<Publisher[]>
    {
        const client = await Database.pool.connect();

        const result = await client.query(
            `
            select p.*
            from
                authors as a
                inner join
                publishers as p
                on
                    a.user = $1
                    and
                    p.id = a.publisher
            `,
            [ user.id ],
        );

        return Promise.all(result.rows.map(Publisher.deserialize));
    }

    public isOwnedByUser(user: User): boolean
    {
        return this.organization.owner.id === user.id;
    }

    public serialize(): ISerializedPublisher
    {
        return {
            id: this.id,
            name: this.name,
            url: this.url,
            organization: this.organization.serialize(),
        };
    }

    private static async deserialize(data: IDatabasePublisher): Promise<Publisher>
    {
        const organization = await Organization.retrieve(data.organization);

        if (!organization)
        {
            throw new Error(`The organization '${data.organization}' does not exist`);
        }

        return new Publisher(
            data.id,
            data.name,
            data.url,
            organization,
        );
    }
}
