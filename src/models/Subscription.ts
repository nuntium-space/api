import Boom from "@hapi/boom";
import { INotExpandedResource } from "../common/INotExpandedResource";
import { ISerializable } from "../common/ISerializable";
import {
  ISerializedSubscription,
  IUpdateSubscription,
  IDatabaseSubscription,
} from "../types/subscription";
import Database from "../utilities/Database";
import Utilities from "../utilities/Utilities";
import { Price } from "./Price";
import { User } from "./User";

export class Subscription implements ISerializable<ISerializedSubscription> {
  private constructor(
    public readonly id: string,
    public readonly status: string,
    public readonly user: User | INotExpandedResource,
    public readonly price: Price | INotExpandedResource,
    private _current_period_end: Date,
    private _cancel_at_period_end: boolean,
    public readonly deleted: boolean,
    public readonly stripe_subscription_id: string
  ) {}

  public get current_period_end(): Date {
    return this._current_period_end;
  }

  public get cancel_at_period_end(): boolean {
    return this._cancel_at_period_end;
  }

  public static async retrieveWithSubscriptionId(
    subscriptionId: string
  ): Promise<Subscription> {
    const result = await Database.pool.query(
      `select * from "subscriptions" where "stripe_subscription_id" = $1`,
      [subscriptionId]
    );

    if (result.rowCount === 0) {
      throw Boom.notFound();
    }

    return Subscription.deserialize(result.rows[0]);
  }

  public async update(data: IUpdateSubscription): Promise<void> {
    this._current_period_end = data.current_period_end
      ? new Date(data.current_period_end * 1000)
      : this.current_period_end;
    this._cancel_at_period_end =
      data.cancel_at_period_end ?? this.cancel_at_period_end;

    await Database.pool
      .query(
        `
        update "subscriptions"
        set
          "current_period_end" = $1,
          "cancel_at_period_end" = $2
        where
          "stripe_subscription_id" = $3
        `,
        [
          this.current_period_end.toISOString(),
          this.cancel_at_period_end,
          this.stripe_subscription_id,
        ]
      )
      .catch(() => {
        throw Boom.badRequest();
      });
  }

  public static async forUser(
    user: User,
    expand?: string[]
  ): Promise<Subscription[]> {
    const result = await Database.pool.query(
      `select * from "subscriptions" where "user" = $1`,
      [user.id]
    );

    return Promise.all(
      result.rows.map((row) => Subscription.deserialize(row, expand))
    );
  }

  public serialize(options?: {
    for?: User | INotExpandedResource;
  }): ISerializedSubscription {
    return {
      id: this.id,
      status: this.status,
      user:
        this.user instanceof User
          ? this.user.serialize({ for: options?.for })
          : this.user,
      price:
        this.price instanceof Price
          ? this.price.serialize({ for: options?.for })
          : this.price,
      current_period_end: this.current_period_end.toISOString(),
      cancel_at_period_end: this.cancel_at_period_end,
      deleted: this.deleted,
    };
  }

  private static async deserialize(
    data: IDatabaseSubscription,
    expand?: string[]
  ): Promise<Subscription> {
    const user = expand?.includes("user")
      ? await User.retrieve(data.user)
      : { id: data.user };

    const price = expand?.includes("price")
      ? await Price.retrieve(
          data.price,
          Utilities.getNestedExpandQuery(expand, "price")
        )
      : { id: data.price };

    return new Subscription(
      data.id,
      data.status,
      user,
      price,
      data.current_period_end,
      data.cancel_at_period_end,
      data.deleted,
      data.stripe_subscription_id
    );
  }
}
