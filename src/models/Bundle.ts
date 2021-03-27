import Boom from "@hapi/boom";
import { INotExpandedResource } from "../common/INotExpandedResource";
import { ISerializable } from "../common/ISerializable";
import { Config } from "../config/Config";
import Database from "../utilities/Database";
import Utilities from "../utilities/Utilities";
import { ISerializedOrganization, Organization } from "./Organization";
import { Publisher } from "./Publisher";
import { User } from "./User";

interface IDatabaseBundle
{
    id: string,
    name: string,
    organization: string,
    active: boolean,
    stripe_product_id: string | null,
}

interface ICreateBundle
{
    name: string,
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
    active: boolean,
}

export class Bundle implements ISerializable<ISerializedBundle>
{
    private constructor
    (
        public readonly id: string,
        private _name: string,
        public readonly organization: Organization | INotExpandedResource,
        public readonly active: boolean,
        public readonly stripe_product_id: string | null,
    )
    {}

    public get name(): string
    {
        return this._name;
    }

    public static async create(data: ICreateBundle, organization: Organization, expand?: string[]): Promise<Bundle>
    {
        if (await Bundle.existsWithNameAndOrganization(data.name, organization))
        {
            throw Boom.conflict(undefined, [
                {
                    field: "name",
                    error: `A bundle named '${data.name}' already exists for this organization`,
                },
            ]);
        }

        const client = await Database.pool.connect();

        await client.query("begin");

        const result = await client
            .query(
                `
                insert into "bundles"
                    ("id", "name", "organization", "active")
                values
                    ($1, $2, $3, $4)
                returning *
                `,
                [
                    Utilities.id(Config.ID_PREFIXES.BUNDLE),
                    data.name,
                    organization.id,
                    true,
                ],
            )
            .catch(async () =>
            {
                await client.query("rollback");

                throw Boom.badRequest();
            });

        await Config.STRIPE.products
            .create({
                name: data.name,
                metadata: {
                    bundle_id: result.rows[0].id,
                },
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
        else if (!this.stripe_product_id)
        {
            throw Boom.badImplementation();
        }

        this._name = data.name ?? this.name;

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

        await Config.STRIPE.products
            .update(
                this.stripe_product_id,
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
        if (!this.stripe_product_id)
        {
            throw Boom.badImplementation();
        }

        const client = await Database.pool.connect();

        await client.query("begin");

        await client.query(
            `update "bundles" set "active" = $1 where "id" = $2`,
            [ false, this.id ],
        );

        await Config.STRIPE.products
            .update(
                this.stripe_product_id,
                {
                    active: false,
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

    public async addPublisher(publisher: Publisher): Promise<void>
    {
        if (publisher.organization.id !== this.organization.id)
        {
            throw Boom.forbidden(`Cannot add publisher '${publisher.id}' to bundle ${this.id}`);
        }

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

    public async removePublisher(publisher: Publisher): Promise<void>
    {
        await Database.pool
            .query(
                `delete from "bundles_publishers" where "bundle" = $1 and "publisher" = $2`,
                [ this.id, publisher.id ],
            );
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

    public static async forPublisher(publisher: Publisher, expand?: string[]): Promise<Bundle[]>
    {
        const result = await Database.pool.query(
            `
            select b.*
            from
                bundles_publishers as bp
                inner join
                v_active_bundles as b
                on bp.bundle = b.id
            where bp.publisher = $1`,
            [ publisher.id ],
        );

        return Promise.all(result.rows.map(row => Bundle.deserialize(row, expand)));
    }

    public serialize(options?: {
        for?: User | INotExpandedResource,
    }): ISerializedBundle
    {
        return {
            id: this.id,
            name: this.name,
            organization: this.organization instanceof Organization
                ? this.organization.serialize({ for: options?.for })
                : this.organization,
            active: this.active,
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
            data.active,
            data.stripe_product_id,
        );
    }
}
