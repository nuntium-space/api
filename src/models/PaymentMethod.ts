import Boom from "@hapi/boom";
import { INotExpandedResource } from "../common/INotExpandedResource";
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

export class PaymentMethod
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

    public static async forUser(user: User, expand?: string[]): Promise<PaymentMethod[]>
    {
        const result = await Database.pool.query(
            `select * from "payment_methods" where "user" = $1`,
            [ user.id ],
        );

        return Promise.all(result.rows.map(row => PaymentMethod.deserialize(row, expand)));
    }

    public serialize(): ISerializedPaymentMethod
    {
        return {
            id: this.id,
            type: this.type,
            data: this.data,
            user: this.user instanceof User
                ? this.user.serialize()
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
}
