import Joi from "joi";
import { Schema } from "../config/Schema";

export interface IDatabaseDraftSource
{
    id: string,
    url: string,
    draft: string,
}

export interface ICreateDraftSource
{
    url: string,
}

export interface ISerializedDraftSource
{
    id: string,
    url: string,
}

export const DRAFT_SOURCE_SCHEMA = {
    OBJ: Joi.object({
        id: Schema.ID.DRAFT_SOURCE.required(),
        url: Schema.URL.required(),
    }),
    CREATE: Joi.object({
        url: Schema.URL.required(),
    }),
} as const;
