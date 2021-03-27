import { User } from "../models/User";
import { INotExpandedResource } from "./INotExpandedResource";

export interface ISerializable<T>
{
    serialize: (options?: {
        for?: User | INotExpandedResource,
    }) => T,
}
