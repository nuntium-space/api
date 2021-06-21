import Joi from "joi";
import { INotExpandedResource } from "../common/INotExpandedResource";
import { Schema } from "../config/Schema";
import { ISerializedPublisher, PUBLISHER_SCHEMA } from "./publisher";
import { ISerializedUser, USER_SCHEMA } from "./user";

export interface IDatabaseAuthorInvite
{
    id: string,
    user: string,
    publisher: string,
    created_at: Date,
    expires_at: Date,
}

export interface ICreateAuthorInvite
{
    email: string,
    publisher: string,
}

export interface ISerializedAuthorInvite
{
    id: string,
    user: ISerializedUser | INotExpandedResource,
    publisher: ISerializedPublisher | INotExpandedResource,
    created_at: string,
    expires_at: string,
}

export const AUTHOR_INVITE_SCHEMA = {
    OBJ: Joi.object({
        id: Schema.ID.AUTHOR.required(),
        user: Joi
            .alternatives()
            .try(
                USER_SCHEMA.OBJ,
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
        created_at: Schema.DATETIME.required(),
        expires_at: Schema.DATETIME.required(),
    }),
    CREATE: Joi.object({
        email: Schema.EMAIL.required(),
    }),
} as const;
