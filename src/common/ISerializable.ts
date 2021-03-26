import { User } from "../models/User";

export interface ISerializable<T>
{
    serialize: (options?: {
        for?: User,
    }) => T,
}
