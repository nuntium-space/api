import Joi from "joi";
import { Schema } from "../config/Schema";

export interface IDatabaseSource
{
    id: string,
    url: string,
    article: string,
}

export interface ICreateSource
{
    url: string,
}

export interface ISerializedSource
{
    id: string,
    url: string,
}

export const SOURCE_SCHEMA = {
    OBJ: Joi.object({
        id: Schema.ID.SOURCE.required(),
        url: Schema.URL.required(),
    }),
    CREATE: Joi.object({
        url: Schema.URL.required(),
    }),
} as const;
