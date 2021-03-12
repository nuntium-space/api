import Boom from "@hapi/boom";
import { Stripe } from "stripe";
import { INotExpandedResource } from "../common/INotExpandedResource";
import { Config } from "../config/Config";
import Database from "../utilities/Database";
import Utilities from "../utilities/Utilities";
import { ISerializedOrganization, Organization } from "./Organization";
import { Publisher } from "./Publisher";

interface IDatabaseBundle
{
    id: string,
    name: string,
    organization: string,
    price: number,
    stripe_product_id: string,
    stripe_price_id: string,
}

interface ICreateBundle
{
    name: string,
    price: number,
}

interface IUpdateBundle
{
    name?: string,
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
    private static _stripe = new Stripe(process.env.STRIPE_SECRET_API_KEY ?? "", {
        apiVersion: "2020-08-27",
    });

    private constructor
    (
        private readonly _id: string,
        private _name: string,
        private readonly _organization: Organization | INotExpandedResource,
        private readonly _price: number,
        private readonly _stripe_product_id: string,
        private readonly _stripe_price_id: string,
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
        if (await Bundle.existsWithNameAndOrganization(data.name, organization))
        {
            throw Boom.conflict(`A bundle named '${data.name}' already exists for this organization`);
        }

        const client = await Database.pool.connect();

        await client.query("begin");

        const result = await client
            .query(
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
            )
            .catch(async () =>
            {
                await client.query("rollback");

                throw Boom.badRequest();
            });

        await Bundle._stripe.products
            .create({
                name: data.name,
                metadata: {
                    bundle_id: result.rows[0].id,
                },
            })
            .then(product =>
            {
                return Bundle._stripe.prices.create({
                    currency: "usd",
                    product: product.id,
                    unit_amount: data.price,
                    metadata: {
                        bundle_id: result.rows[0].id,
                    },
                });
            })
            .catch(async () =>
            {
                await client.query("rollback");

                throw Boom.badRequest();
            });

        await client.query("commit");

        client.release();

        return Bundle.deserialize(result.rows[0], expand);
    }

    public static async retrieve(id: string, expand?: string[]): Promise<Bundle>
    {
        const result = await Database.pool.query(
            `select * from "bundles" where "id" = $1`,
            [ id ],
        );

        if (result.rowCount === 0)
        {
            throw Boom.notFound();
        }

        return Bundle.deserialize(result.rows[0], expand);
    }

    public async update(data: IUpdateBundle): Promise<void>
    {
        if (data.name && await Bundle.existsWithNameAndOrganization(data.name, this.organization.id))
        {
            throw Boom.conflict(`A bundle named '${data.name}' already exists for this organization`);
        }

        this._name = data.name ?? this.name;

        console.log(this._stripe_price_id);

        const client = await Database.pool.connect();

        await client.query("begin");

        await client
            .query(
                `update "bundles" set "name" = $1 where "id" = $2`,
                [ this.name, this.id ],
            )
            .catch(async () =>
            {
                await client.query("rollback");

                throw Boom.badRequest();
            });

        await Bundle._stripe.products
            .update(
                this._stripe_product_id,
                {
                    name: this.name,
                },
            )
            .catch(async () =>
            {
                await client.query("rollback");

                throw Boom.badRequest();
            });

        await client.query("commit");

        client.release();
    }

    public async delete(): Promise<void>
    {
        await Database.pool.query(
            `delete from "bundles" where "id" = $1`,
            [ this.id ],
        );
    }

    public async addPublisher(publisher: Publisher): Promise<void>
    {
        await Database.pool
            .query(
                `insert into "bundles_publishers" ("bundle", "publisher") values ($1, $2)`,
                [ this.id, publisher.id ],
            )
            .catch(() =>
            {
                throw Boom.badRequest(`Cannot add publisher '${publisher.id}' to bundle ${this.id}`);
            });
    }

    public static async existsWithNameAndOrganization(name: string, organization: Organization | string): Promise<boolean>
    {
        const result = await Database.pool.query(
            `select id from "bundles" where "name" = $1 and "organization" = $2`,
            [
                name,
                organization instanceof Organization
                    ? organization.id
                    : organization,
            ],
        );

        return result.rowCount > 0;
    }

    public static async forOrganization(organization: Organization, expand?: string[]): Promise<Bundle[]>
    {
        const result = await Database.pool.query(
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
        const organization = expand?.includes("organization")
            ? await Organization.retrieve(data.organization)
            : { id: data.organization };

        return new Bundle(
            data.id,
            data.name,
            organization,
            parseInt(data.price.toString()),
            data.stripe_product_id,
            data.stripe_price_id,
        );
    }
}
