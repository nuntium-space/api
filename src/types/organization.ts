import Joi from "joi";
import { Schema } from "../config/Schema";
import { ISerializedUser, USER_SCHEMA } from "./user";

export interface IDatabaseOrganization
{
    id: string,
    name: string,
    user: string,
    stripe_account_id: string,
    stripe_account_enabled: boolean,
}

export interface ICreateOrganization
{
    name: string,
}

export interface IUpdateOrganization
{
    name?: string,
    stripe_account_enabled?: boolean,
}

export interface ISerializedOrganization
{
    id: string,
    name: string,
    owner: ISerializedUser,
    stripe_account_enabled: boolean,
}

export const ORGANIZATION_SCHEMA = {
    OBJ: Joi.object({
        id: Schema.ID.ORGANIZATION.required(),
        name: Schema.STRING.max(50).required(),
        owner: USER_SCHEMA.OBJ.required(),
        stripe_account_enabled: Schema.BOOLEAN.required(),
    }),
    CREATE: Joi.object({
        name: Schema.STRING.max(50).required(),
    }),
    UPDATE: Joi.object({
        name: Schema.STRING.max(50),
    }),
} as const;