import { Config } from "../config/Config";
import Database from "../utilities/Database";
import Utilities from "../utilities/Utilities";
import { ISerializedOrganization, Organization } from "./Organization";

interface IDatabasePublisher
{
    id: string,
    name: string,
    url: string,
    image: Blob,
    organization: string,
}

interface ICreatePublisher
{
    name: string,
    url: string,
    image: Blob,
    organization: string,
}

interface IUpdatePublisher
{
    name?: string,
    url?: string,
    image?: Blob,
}

export interface ISerializedPublisher
{
    id: string,
    name: string,
    url: string,
    image: string,
    organization: ISerializedOrganization,
}

export class Publisher
{
    private constructor
    (
        private readonly _id: string,
        private _name: string,
        private _url: string,
        private _image: Blob,
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

    public get image(): Blob
    {
        return this._image;
    }

    public get organization(): Organization
    {
        return this._organization;
    }

    public static async create(data: ICreatePublisher): Promise<Publisher>
    {
        const result = await Database.client.query(
            `
            insert into "publishers"
                ("id", "name", "url", "image", "organization")
            values
                ($1, $2, $3, $4, $5)
            returning *
            `,
            [
                Utilities.id(Config.ID_PREFIXES.PUBLISHER),
                data.name,
                data.url,
                data.image,
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
        const result = await Database.client.query(
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
        this._image = data.image ?? this.image;

        const result = await Database.client.query(
            `
            update "publishers"
            set
                "name" = $1,
                "url" = $2,
                "image" = $3
            where
                "id" = $4
            `,
            [
                this.name,
                this.url,
                this.image,
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
        const result = await Database.client.query(
            `delete from "publishers" where "id" = $1`,
            [ this.id ],
        );

        if (result.rowCount === 0)
        {
            throw new Error("Cannot delete publisher");
        }
    }

    public serialize(): ISerializedPublisher
    {
        return {
            id: this.id,
            name: this.name,
            url: this.url,
            image: URL.createObjectURL(this.image),
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
            data.image,
            organization,
        );
    }
}
