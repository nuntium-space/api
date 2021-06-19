import Joi from "joi";
import { Schema } from "../config/Schema";

export interface IDatabaseUser
{
    id: string,
    full_name: string | null,
    email: string,
    stripe_customer_id: string | null,
}

export interface ICreateUser
{
    full_name?: string,
    email: string,
}

export interface IUpdateUser
{
    full_name?: string,
    email?: string,
}

export interface IUserSettings
{
    language: string | null,
}

export interface IUpdateUserSettings
{
    language?: string,
}

export interface ISerializedUser
{
    id: string,
    full_name: string | null,
    email: string,
}

export const USER_SCHEMA = {
    OBJ: Joi.object({
        id: Schema.ID.USER.required(),
        full_name: Schema.NULLABLE(Schema.STRING).optional(),
        email: Schema.EMAIL.optional(),
    }),
    UPDATE: Joi.object({
        full_name: Schema.STRING,
        email: Schema.EMAIL,
    }),
} as const;
