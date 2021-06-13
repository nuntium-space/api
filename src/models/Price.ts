import Boom from "@hapi/boom";
import Joi from "joi";
import { INotExpandedResource } from "../common/INotExpandedResource";
import { ISerializable } from "../common/ISerializable";
import { Config } from "../config/Config";
import { Schema } from "../config/Schema";
import Database from "../utilities/Database";
import Utilities from "../utilities/Utilities";
import { Bundle, ISerializedBundle } from "./Bundle";
import { User } from "./User";

interface IDatabasePrice
{
    id: string,
    amount: number,
    currency: string,
    bundle: string,
    active: boolean,
    stripe_price_id: string | null,
}

interface ICreatePrice
{
    amount: number,
    currency: string,
}

interface IUpdatePrice
{
    active?: boolean,
}

export interface ISerializedPrice
{
    id: string,
    amount: number,
    currency: string,
    bundle: ISerializedBundle | INotExpandedResource,
    active: boolean,
}

export class Price implements ISerializable<ISerializedPrice>
{
    private constructor
    (
        public readonly id: string,
        public readonly amount: number,
        public readonly currency: string,
        public readonly bundle: Bundle | INotExpandedResource,
        private _active: boolean,
        public readonly stripe_price_id: string | null,
    )
    {}

    public get active(): boolean
    {
        return this._active;
    }

    public static async create(data: ICreatePrice, bundle: Bundle, expand?: string[]): Promise<Price>
    {
        if (!bundle.stripe_product_id)
        {
            throw Boom.badImplementation();
        }

        const currencyConfig = Config.CURRENCIES.find(c => c.name === data.currency);

        if (!currencyConfig)
        {
            throw Boom.badData(undefined, [
                {
                    field: "currency",
                    error: "custom.price.currency.not_supported",
                },
            ]);
        }

        if (data.amount < currencyConfig.min)
        {
            throw Boom.badData(undefined, [
                {
                    field: "amount",
                    error: "custom.price.amount.not_enough",
                    params: {
                        MIN_AMOUNT: Utilities.formatCurrencyAmount(currencyConfig.min, data.currency),
                        CURRENCY: data.currency,
                    },
                },
            ]);
        }

        const client = await Database.pool.connect();

        await client.query("begin");

        const result = await client
            .query(
                `
                insert into "prices"
                    ("id", "amount", "currency", "bundle", "active")
                values
                    ($1, $2, $3, $4, $5)
                returning *
                `,
                [
                    Utilities.id(Config.ID_PREFIXES.PRICE),
                    data.amount,
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
                unit_amount: data.amount,
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

    public async update(data: IUpdatePrice): Promise<void>
    {
        if (!this.stripe_price_id)
        {
            throw Boom.badImplementation();
        }

        this._active = data.active ?? this.active;

        const client = await Database.pool.connect();

        await client.query("begin");

        await client.query(
            `update "prices" set "active" = $1 where "id" = $2`,
            [ this.active, this.id ],
        );

        await Config.STRIPE.prices
            .update(
                this.stripe_price_id,
                {
                    active: this.active,
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

    public static async forBundle(bundle: Bundle, options?: {
        active?: boolean,
        expand?: string[],
    }): Promise<Price[]>
    {
        let query = `select * from "prices" where "bundle" = $1`;
        const params: any[] = [ bundle.id ];

        if (options && typeof options.active === "boolean")
        {
            query += `and "active" = $2`;
            params.push(options.active);
        }

        const result = await Database.pool.query(query, params);

        return Promise.all(result.rows.map(row => Price.deserialize(row, options?.expand)));
    }

    public serialize(options?: {
        for?: User | INotExpandedResource,
    }): ISerializedPrice
    {
        return {
            id: this.id,
            amount: this.amount,
            currency: this.currency,
            bundle: this.bundle instanceof Bundle
                ? this.bundle.serialize({ for: options?.for })
                : this.bundle,
            active: this.active,
        };
    }

    private static async deserialize(data: IDatabasePrice, expand?: string[]): Promise<Price>
    {
        const bundle = expand?.includes("bundle")
            ? await Bundle.retrieve(data.bundle, expand.filter(e => e.startsWith("bundle.")).map(e => e.replace("bundle.", "")))
            : { id: data.bundle };

        return new Price(
            data.id,
            data.amount,
            data.currency,
            bundle,
            data.active,
            data.stripe_price_id,
        );
    }

    public static readonly SCHEMA = {
        OBJ: Joi.object({
            id: Schema.ID.PRICE.required(),
            amount: Schema.MONEY.required(),
            currency: Schema.CURRENCY.required(),
            bundle: Joi
                .alternatives()
                .try(
                    Bundle.SCHEMA.OBJ,
                    Schema.NOT_EXPANDED_RESOURCE(Schema.ID.BUNDLE),
                )
                .required(),
            active: Schema.BOOLEAN.required(),
        }),
        CREATE: Joi.object({
            amount: Schema.MONEY.required(),
            currency: Schema.CURRENCY.required(),
        }),
        UPDATE: Joi.object({
            active: Schema.BOOLEAN.optional(),
        }),
    } as const;
}
