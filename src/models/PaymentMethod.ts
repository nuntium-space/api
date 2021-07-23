import Boom from "@hapi/boom";
import { INotExpandedResource } from "../common/INotExpandedResource";
import { ISerializable } from "../common/ISerializable";
import { Model } from "../config/Model";
import {
  ISerializedPaymentMethod,
  IPaymentMethod,
  PAYMENT_METHOD_MODEL,
} from "../types/payment-method";
import Database from "../utilities/Database";
import { User } from "./User";

export class PaymentMethod
  extends Model
  implements ISerializable<ISerializedPaymentMethod>
{
  public constructor(protected readonly record: IPaymentMethod) {
    super(PAYMENT_METHOD_MODEL, record);
  }

  ////////////////
  // PROPERTIES //
  ////////////////

  public get id(): string {
    return this.record.id;
  }

  public get type(): string {
    return this.record.type;
  }

  public get data(): any {
    return this.record.data;
  }

  public get user(): User | INotExpandedResource {
    return this.record.user;
  }

  public get stripe_id(): string {
    return this.record.stripe_id;
  }

  //////////
  // CRUD //
  //////////

  public static async retrieve(id: string): Promise<PaymentMethod> {
    return super._retrieve({
      kind: PAYMENT_METHOD_MODEL,
      filter: { id },
    });
  }

  public static async retrieveDefaultForUser(
    user: string
  ): Promise<PaymentMethod | null> {
    const result = await Database.pool.query(
      `select * from "default_payment_methods" where "user" = $1`,
      [user]
    );

    if (result.rowCount === 0) {
      return null;
    }

    return PaymentMethod.retrieve(result.rows[0].payment_method);
  }

  public static async retrieveWithStripeId(
    stripe_id: string
  ): Promise<PaymentMethod> {
    return super._retrieve({
      kind: PAYMENT_METHOD_MODEL,
      filter: { stripe_id },
    });
  }

  public static async forUser(
    user: User,
    expand?: string[]
  ): Promise<PaymentMethod[]> {
    return super._for({
      kind: PAYMENT_METHOD_MODEL,
      filter: {
        key: "user",
        value: user instanceof User ? user.id : user,
      },
      expand,
    });
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
}
