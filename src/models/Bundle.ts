import { INotExpandedResource } from "../common/INotExpandedResource";
import { Config } from "../config/Config";
import Database from "../utilities/Database";
import Utilities from "../utilities/Utilities";
import { ISerializedOrganization, Organization } from "./Organization";

interface IDatabaseBundle
{
    id: string,
    name: string,
    organization: string,
    price: number,
}

interface ICreateBundle
{
    name: string,
    price: number,
}

interface IUpdateBundle
{
    name?: string,
    price?: number,
}

export interface ISerializedBundle
{
    id: string,
    name: string,
    organization: ISerializedOrganization | INotExpandedResource,
    price: number,
}

export class Bundle
{
    private constructor
    (
        private readonly _id: string,
        private _name: string,
        private _organization: Organization | INotExpandedResource,
        private _price: number,
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

    public get organization(): Organization | INotExpandedResource
    {
        return this._organization;
    }

    public get price(): number
    {
        return this._price;
    }

    public static async create(data: ICreateBundle, organization: Organization, expand?: string[]): Promise<Bundle>
    {
        const result = await Database.client.query(
            `
            insert into "bundles"
                ("id", "name", "organization", "price")
            values
                ($1, $2, $3, $4)
            returning *
            `,
            [
                Utilities.id(Config.ID_PREFIXES.BUNDLE),
                data.name,
                organization.id,
                data.price,
            ],
        );

        if (result.rowCount === 0)
        {
            throw new Error("Cannot create bundle");
        }

        return Bundle.deserialize(result.rows[0], expand);
    }

    public static async retrieve(id: string, expand?: string[]): Promise<Bundle | null>
    {
        const result = await Database.client.query(
            `select * from "bundles" where "id" = $1`,
            [ id ],
        );

        if (result.rowCount === 0)
        {
            return null;
        }

        return Bundle.deserialize(result.rows[0], expand);
    }

    public async update(data: IUpdateBundle): Promise<void>
    {
        this._name = data.name ?? this.name;
        this._price = data.price ?? this.price;

        const result = await Database.client.query(
            `
            update "bundles"
            set
                "name" = $1,
                "price" = $2
            where
                "id" = $3
            `,
            [
                this.name,
                this.price,
                this.id,
            ],
        );

        if (result.rowCount === 0)
        {
            throw new Error("Cannot update bundle");
        }
    }

    public async delete(): Promise<void>
    {
        const result = await Database.client.query(
            `delete from "bundles" where "id" = $1`,
            [ this.id ],
        );

        if (result.rowCount === 0)
        {
            throw new Error("Cannot delete bundle");
        }
    }

    public static async forOrganization(organization: Organization, expand?: string[]): Promise<Bundle[]>
    {
        const result = await Database.client.query(
            `select * from "bundles" where "organization" = $1`,
            [ organization.id ],
        );

        return Promise.all(result.rows.map(row => Bundle.deserialize(row, expand)));
    }

    public serialize(): ISerializedBundle
    {
        return {
            id: this.id,
            name: this.name,
            organization: this.organization instanceof Organization
                ? this.organization.serialize()
                : this.organization,
            price: this.price,
        };
    }

    private static async deserialize(data: IDatabaseBundle, expand?: string[]): Promise<Bundle>
    {
        let organization: Organization | INotExpandedResource;

        if (expand?.includes("organization"))
        {
            const temp = await Organization.retrieve(data.organization);

            if (!temp)
            {
                throw new Error(`The author '${data.organization}' does not exist`);
            }

            organization = temp;
        }
        else
        {
            organization = { id: data.organization };
        }

        return new Bundle(
            data.id,
            data.name,
            organization,
            parseInt(data.price.toString()),
        );
    }
}
