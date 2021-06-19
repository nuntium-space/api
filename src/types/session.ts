import Joi from "joi";
import { Schema } from "../config/Schema";
import { ISerializedUser, USER_SCHEMA } from "./user";

export interface IDatabaseSession
{
    id: string,
    user: string,
    expires_at: Date,
}

export interface ISerializedSession
{
    id: string,
    user: ISerializedUser,
    expires_at: string,
}

export const SESSION_SCHEMA = {
    OBJ: Joi.object({
        id: Schema.ID.SESSION.required(),
        user: USER_SCHEMA.OBJ.required(),
        expires_at: Schema.DATETIME.required(),
    }),
    CREATE: Joi.object({
        email: Schema.EMAIL.required(),
    }),
} as const;
