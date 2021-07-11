import Boom from "@hapi/boom";
import { INotExpandedResource } from "../common/INotExpandedResource";
import { ISerializable } from "../common/ISerializable";
import { Config } from "../config/Config";
import {
  ISerializedPrice,
  ICreatePrice,
  IUpdatePrice,
  IDatabasePrice,
  PriceBillingPeriod,
} from "../types/price";
import Database from "../utilities/Database";
import Utilities from "../utilities/Utilities";
import { Bundle } from "./Bundle";
import { User } from "./User";

export class Price implements ISerializable<ISerializedPrice> {
  private constructor(
    public readonly id: string,
    public readonly amount: number,
    public readonly currency: string,
    public readonly billing_period: PriceBillingPeriod,
    public readonly bundle: Bundle | INotExpandedResource,
    private _active: boolean,
    public readonly stripe_price_id: string | null
  ) {}

  public get active(): boolean {
    return this._active;
  }

  public static async create(
    data: ICreatePrice,
    bundle: Bundle
  ): Promise<INotExpandedResource> {
    if (!bundle.stripe_product_id) {
      throw Boom.badImplementation();
    }

    const currencyConfig = Config.CURRENCIES.find(
      (c) => c.name === data.currency
    );

    if (!currencyConfig) {
      throw Boom.badData(undefined, [
        {
          field: "currency",
          error: "custom.price.currency.not_supported",
        },
      ]);
    }

    if (data.amount < currencyConfig.min) {
      throw Boom.badData(undefined, [
        {
          field: "amount",
          error: "custom.price.amount.not_enough",
          params: {
            MIN_AMOUNT: Utilities.formatCurrencyAmount(
              currencyConfig.min,
              data.currency
            ),
            CURRENCY: data.currency,
          },
        },
      ]);
    }

    const id = Utilities.id(Config.ID_PREFIXES.PRICE);

    const client = await Database.pool.connect();
    await client.query("begin");

    await client
      .query(
        `
        insert into "prices"
          ("id", "amount", "currency", "billing_period", "bundle", "active")
        values
          ($1, $2, $3, $4, $5, $6)
        `,
        [id, data.amount, data.currency, data.billing_period, bundle.id, true]
      )
      .catch(async () => {
        await client.query("rollback");

        throw Boom.badRequest();
      });

    await Config.STRIPE.prices
      .create({
        product: bundle.stripe_product_id,
        unit_amount: data.amount,
        currency: data.currency,
        recurring: {
          interval: data.billing_period,
        },
        tax_behavior: "exclusive",
        metadata: {
          price_id: id,
        },
      })
      .catch(async () => {
        await client.query("rollback");

        throw Boom.badRequest();
      });

    await client.query("commit");
    client.release();

    return { id };
  }

  public static async retrieve(id: string, expand?: string[]): Promise<Price> {
    const result = await Database.pool.query(
      `select * from "prices" where "id" = $1`,
      [id]
    );

    if (result.rowCount === 0) {
      throw Boom.notFound();
    }

    return Price.deserialize(result.rows[0], expand);
  }

  public async update(data: IUpdatePrice): Promise<void> {
    if (!this.stripe_price_id) {
      throw Boom.badImplementation();
    }

    this._active = data.active ?? this.active;

    const client = await Database.pool.connect();

    await client.query("begin");

    await client.query(`update "prices" set "active" = $1 where "id" = $2`, [
      this.active,
      this.id,
    ]);

    await Config.STRIPE.prices
      .update(this.stripe_price_id, {
        active: this.active,
      })
      .catch(async () => {
        await client.query("rollback");

        throw Boom.badRequest();
      });

    await client.query("commit");

    client.release();
  }

  public static async forBundle(
    bundle: Bundle,
    options?: {
      active?: boolean;
      expand?: string[];
    }
  ): Promise<Price[]> {
    let query = `select * from "prices" where "bundle" = $1`;
    const params: any[] = [bundle.id];

    if (options && typeof options.active === "boolean") {
      query += `and "active" = $2`;
      params.push(options.active);
    }

    const result = await Database.pool.query(query, params);

    return Promise.all(
      result.rows.map((row) => Price.deserialize(row, options?.expand))
    );
  }

  public serialize(options?: {
    for?: User | INotExpandedResource;
  }): ISerializedPrice {
    return {
      id: this.id,
      amount: this.amount,
      currency: this.currency,
      billing_period: this.billing_period,
      bundle:
        this.bundle instanceof Bundle
          ? this.bundle.serialize({ for: options?.for })
          : this.bundle,
      active: this.active,
    };
  }

  private static async deserialize(
    data: IDatabasePrice,
    expand?: string[]
  ): Promise<Price> {
    const bundle = expand?.includes("bundle")
      ? await Bundle.retrieve(
          data.bundle,
          Utilities.getNestedExpandQuery(expand, "bundle")
        )
      : { id: data.bundle };

    return new Price(
      data.id,
      data.amount,
      data.currency,
      data.billing_period,
      bundle,
      data.active,
      data.stripe_price_id
    );
  }
}
