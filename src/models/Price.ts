import Boom from "@hapi/boom";
import { INotExpandedResource } from "../common/INotExpandedResource";
import { Config } from "../config/Config";
import Database from "../utilities/Database";
import Utilities from "../utilities/Utilities";
import { Bundle, ISerializedBundle } from "./Bundle";

interface IDatabasePrice
{
    id: string,
    value: number,
    currency: string,
    bundle: string,
    active: boolean,
    stripe_price_id: string | null,
}

interface ICreatePrice
{
    value: number,
    currency: string,
}

export interface ISerializedPrice
{
    id: string,
    value: number,
    currency: string,
    bundle: ISerializedBundle | INotExpandedResource,
    active: boolean,
}

export class Price
{
    private constructor
    (
        public readonly id: string,
        public readonly value: number,
        public readonly currency: string,
        public readonly bundle: Bundle | INotExpandedResource,
        public readonly active: boolean,
        public readonly stripe_price_id: string | null,
    )
    {}

    public static async create(data: ICreatePrice, bundle: Bundle, expand?: string[]): Promise<Price>
    {
        if (!bundle.stripe_product_id)
        {
            throw Boom.badImplementation();
        }

        const client = await Database.pool.connect();

        await client.query("begin");

        const result = await client
            .query(
                `
                insert into "prices"
                    ("id", "value", "currency", "bundle", "active")
                values
                    ($1, $2, $3, $4, $5)
                returning *
                `,
                [
                    Utilities.id(Config.ID_PREFIXES.PRICE),
                    data.value,
                    data.currency,
                    bundle.id,
                    true,
                ],
            )
            .catch(async () =>
            {
                await client.query("rollback");

                throw Boom.badRequest();
            });

        await Config.STRIPE.prices
            .create({
                product: bundle.stripe_product_id,
                unit_amount: data.value,
                currency: data.currency,
                recurring: {
                    interval: "month",
                },
                metadata: {
                    price_id: result.rows[0].id,
                },
            })
            .catch(async () =>
            {
                await client.query("rollback");

                throw Boom.badRequest();
            });

        await client.query("commit");

        client.release();

        return Price.deserialize(result.rows[0], expand);
    }

    public static async retrieve(id: string, expand?: string[]): Promise<Price>
    {
        const result = await Database.pool.query(
            `select * from "prices" where "id" = $1`,
            [ id ],
        );

        if (result.rowCount === 0)
        {
            throw Boom.notFound();
        }

        return Price.deserialize(result.rows[0], expand);
    }

    public async delete(): Promise<void>
    {
        if (!this.stripe_price_id)
        {
            throw Boom.badImplementation();
        }

        const client = await Database.pool.connect();

        await client.query("begin");

        await client.query(
            `update "prices" set "active" = $1 where "id" = $2`,
            [ false, this.id ],
        );

        await Config.STRIPE.prices
            .update(
                this.stripe_price_id,
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

    public static async forBundle(bundle: Bundle, expand?: string[]): Promise<Price[]>
    {
        const result = await Database.pool.query(
            `select * from "prices" where "bundle" = $1`,
            [ bundle.id ],
        );

        return Promise.all(result.rows.map(row => Price.deserialize(row, expand)));
    }

    public serialize(): ISerializedPrice
    {
        return {
            id: this.id,
            value: this.value,
            currency: this.currency,
            bundle: this.bundle instanceof Bundle
                ? this.bundle.serialize()
                : this.bundle,
            active: this.active,
        };
    }

    private static async deserialize(data: IDatabasePrice, expand?: string[]): Promise<Price>
    {
        const bundle = expand?.includes("bundle")
            ? await Bundle.retrieve(data.bundle)
            : { id: data.bundle };

        return new Price(
            data.id,
            data.value,
            data.currency,
            bundle,
            data.active,
            data.stripe_price_id,
        );
    }
}
