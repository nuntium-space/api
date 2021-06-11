import Boom from "@hapi/boom";
import Joi from "joi";
import { INotExpandedResource } from "../common/INotExpandedResource";
import { ISerializable } from "../common/ISerializable";
import { Schema } from "../config/Schema";
import Database from "../utilities/Database";
import { ISerializedUser, User } from "./User";

interface IDatabasePaymentMethod
{
    id: string,
    type: string,
    data: any,
    user: string,
    stripe_id: string,
}

export interface ISerializedPaymentMethod
{
    id: string,
    type: string,
    data: any,
    user: ISerializedUser | INotExpandedResource,
}

export class PaymentMethod implements ISerializable<ISerializedPaymentMethod>
{
    private constructor
    (
        private readonly _id: string,
        private readonly _type: string,
        private readonly _data: any,
        private readonly _user: User | INotExpandedResource,
        private readonly _stripe_id: string,
    )
    {}

    public get id(): string
    {
        return this._id;
    }

    public get type(): string
    {
        return this._type;
    }

    public get data(): any
    {
        return this._data;
    }

    public get user(): User | INotExpandedResource
    {
        return this._user;
    }

    public get stripe_id(): string
    {
        return this._stripe_id;
    }

    public static async retrieve(id: string): Promise<PaymentMethod>
    {
        const result = await Database.pool.query(
            `select * from "payment_methods" where "id" = $1`,
            [ id ],
        );

        if (result.rowCount === 0)
        {
            throw Boom.notFound();
        }

        return PaymentMethod.deserialize(result.rows[0]);
    }

    public static async retrieveDefaultForUser(userId: string): Promise<PaymentMethod | null>
    {
        const result = await Database.pool.query(
            `select * from "default_payment_methods" where "user" = $1`,
            [ userId ],
        );

        if (result.rowCount === 0)
        {
            return null;
        }

        return PaymentMethod.retrieve(result.rows[0].payment_method);
    }

    public static async retrieveWithStripeId(stripeId: string): Promise<PaymentMethod>
    {
        const result = await Database.pool.query(
            `select * from "payment_methods" where "stripe_id" = $1`,
            [ stripeId ],
        );

        if (result.rowCount === 0)
        {
            throw Boom.notFound();
        }

        return PaymentMethod.deserialize(result.rows[0]);
    }

    public static async forUser(user: User, expand?: string[]): Promise<PaymentMethod[]>
    {
        const result = await Database.pool.query(
            `select * from "payment_methods" where "user" = $1`,
            [ user.id ],
        );

        return Promise.all(result.rows.map(row => PaymentMethod.deserialize(row, expand)));
    }

    public serialize(options?: {
        for?: User | INotExpandedResource,
    }): ISerializedPaymentMethod
    {
        return {
            id: this.id,
            type: this.type,
            data: this.data,
            user: this.user instanceof User
                ? this.user.serialize({ for: options?.for })
                : this.user,
        };
    }

    private static async deserialize(data: IDatabasePaymentMethod, expand?: string[]): Promise<PaymentMethod>
    {
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

    public static readonly SCHEMA = {
        OBJ: Joi.object({
            id: Schema.ID.PAYMENT_METHOD.required(),
            type: Schema.STRING.required(),
            data: Joi.object().required(),
            user: Joi
                .alternatives()
                .try(
                    User.SCHEMA.OBJ,
                    Schema.NOT_EXPANDED_RESOURCE(Schema.ID.USER),
                )
                .required(),
            __metadata: Joi.object({
                is_default: Joi.boolean().required(),
            }),
        }),
    } as const;
}
