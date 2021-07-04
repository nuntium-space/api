import Joi from "joi";
import { Schema } from "../config/Schema";

export interface IDatabaseDraftSource {
  id: string;
  url: string;
  draft: string;
}

export interface ICreateDraftSource {
  url: string;
}

export interface ISerializedDraftSource {
  url: string;
}

export const DRAFT_SOURCE_SCHEMA = {
  OBJ: Joi.object({
    url: Schema.URL.required(),
  }),
  CREATE: Joi.object({
    url: Schema.URL.required(),
  }),
} as const;
