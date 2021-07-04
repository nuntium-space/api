import Joi from "joi";
import { Schema } from "../config/Schema";
import { ISerializedOrganization, ORGANIZATION_SCHEMA } from "./organization";

export interface IDatabasePublisher {
  id: string;
  name: string;
  url: string;
  organization: string;
  verified: boolean;
  dns_txt_value: string;
}

export interface ICreatePublisher {
  name: string;
  url: string;
}

export interface IUpdatePublisher {
  name?: string;
  url?: string;
}

export interface ISerializedPublisher {
  id: string;
  name: string;
  url: string;
  organization: ISerializedOrganization;
  verified: boolean;
  imageUrl: string;
}

export const PUBLISHER_SCHEMA = {
  OBJ: Joi.object({
    id: Schema.ID.PUBLISHER.required(),
    name: Schema.STRING.max(50).required(),
    url: Schema.URL.required(),
    organization: ORGANIZATION_SCHEMA.OBJ.required(),
    verified: Schema.BOOLEAN.required(),
    imageUrl: Schema.STRING.required(),
    __metadata: Joi.object({
      is_author: Schema.BOOLEAN.required(),
      is_subscribed: Schema.BOOLEAN.required(),
    }),
  }),
  CREATE: Joi.object({
    name: Schema.STRING.max(50).required(),
    url: Schema.URL.required(),
  }),
  UPDATE: Joi.object({
    name: Schema.STRING.max(50),
    url: Schema.URL,
  }),
} as const;
