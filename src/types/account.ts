import { INotExpandedResource } from "../common/INotExpandedResource";
import { ISerializedUser, User } from "../models/User";

export interface IDatabaseAccount
{
    id: string,
    user: string,
    type: string,
    external_id: string,
}

export interface ICreateAccount
{
    user: User,
    type: string,
    external_id: string,
}

export interface ISerializedAccount
{
    id: string,
    user: ISerializedUser | INotExpandedResource,
    type: string,
}
