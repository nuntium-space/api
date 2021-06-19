import Joi from "joi";
import { INotExpandedResource } from "../common/INotExpandedResource";
import { Schema } from "../config/Schema";
import { ISerializedPublisher, Publisher } from "../models/Publisher";
import { ISerializedUser, User } from "../models/User";

export interface IDatabaseAuthor
{
    id: string,
    user: string,
    publisher: string,
}

export interface ICreateAuthor
{
    email: string,
    publisher: string,
}

export interface ISerializedAuthor
{
    id: string,
    user: ISerializedUser | INotExpandedResource,
    publisher: ISerializedPublisher | INotExpandedResource,
}

export const AUTHOR_SCHEMA = {
    OBJ: Joi.object({
        id: Schema.ID.AUTHOR.required(),
        user: Joi
            .alternatives()
            .try(
                User.SCHEMA.OBJ,
                Schema.NOT_EXPANDED_RESOURCE(Schema.ID.USER),
            )
            .required(),
        publisher: Joi
            .alternatives()
            .try(
                PUBLISHER_SCHEMA.OBJ,
                Schema.NOT_EXPANDED_RESOURCE(Schema.ID.PUBLISHER),
            )
            .required(),
    }),
    CREATE: Joi.object({
        email: Schema.EMAIL.required(),
    }),
} as const;
