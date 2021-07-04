import Boom from "@hapi/boom";
import { INotExpandedResource } from "../common/INotExpandedResource";
import { ISerializable } from "../common/ISerializable";
import {
  ISerializedPaymentMethod,
  IDatabasePaymentMethod,
} from "../types/payment-method";
import Database from "../utilities/Database";
import { User } from "./User";

export class PaymentMethod implements ISerializable<ISerializedPaymentMethod> {
  private constructor(
    public readonly id: string,
    public readonly type: string,
    public readonly data: any,
    public readonly user: User | INotExpandedResource,
    public readonly stripe_id: string
  ) {}

  public static async retrieve(id: string): Promise<PaymentMethod> {
    const result = await Database.pool.query(
      `select * from "payment_methods" where "id" = $1`,
      [id]
    );

    if (result.rowCount === 0) {
      throw Boom.notFound();
    }

    return PaymentMethod.deserialize(result.rows[0]);
  }

  public static async retrieveDefaultForUser(
    userId: string
  ): Promise<PaymentMethod | null> {
    const result = await Database.pool.query(
      `select * from "default_payment_methods" where "user" = $1`,
      [userId]
    );

    if (result.rowCount === 0) {
      return null;
    }

    return PaymentMethod.retrieve(result.rows[0].payment_method);
  }

  public static async retrieveWithStripeId(
    stripeId: string
  ): Promise<PaymentMethod> {
    const result = await Database.pool.query(
      `select * from "payment_methods" where "stripe_id" = $1`,
      [stripeId]
    );

    if (result.rowCount === 0) {
      throw Boom.notFound();
    }

    return PaymentMethod.deserialize(result.rows[0]);
  }

  public static async forUser(
    user: User,
    expand?: string[]
  ): Promise<PaymentMethod[]> {
    const result = await Database.pool.query(
      `select * from "payment_methods" where "user" = $1`,
      [user.id]
    );

    return Promise.all(
      result.rows.map((row) => PaymentMethod.deserialize(row, expand))
    );
  }

  public async setAsDefault(): Promise<void> {
    let user: User;

    if (!(this.user instanceof User)) {
      user = await User.retrieve(this.user.id);
    } else {
      user = this.user;
    }

    await user.removeDefaultPaymentMethod();

    await Database.pool
      .query(
        `insert into "default_payment_methods" ("user", "payment_method") values ($1, $2)`,
        [this.user.id, this.id]
      )
      .catch(() => {
        throw Boom.badImplementation();
      });
  }

  public serialize(options?: {
    for?: User | INotExpandedResource;
  }): ISerializedPaymentMethod {
    return {
      id: this.id,
      type: this.type,
      data: this.data,
      user:
        this.user instanceof User
          ? this.user.serialize({ for: options?.for })
          : this.user,
    };
  }

  private static async deserialize(
    data: IDatabasePaymentMethod,
    expand?: string[]
  ): Promise<PaymentMethod> {
    const user = expand?.includes("user")
      ? await User.retrieve(data.user)
      : { id: data.user };

    return new PaymentMethod(
      data.id,
      data.type,
      data.data,
      user,
      data.stripe_id
    );
  }
}
