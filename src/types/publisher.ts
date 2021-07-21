import Joi from "joi";
import { ModelKind } from "../config/Model";
import { Schema } from "../config/Schema";
import { Organization } from "../models/Organization";
import { Publisher } from "../models/Publisher";
import { ISerializedOrganization, ORGANIZATION_SCHEMA } from "./organization";
import { USER_MODEL } from "./user";

export interface IPublisher {
  id: string;
  name: string;
  url: string;
  organization: Organization;
  verified: boolean;
  dns_txt_value: string;
}

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

export const PUBLISHER_MODEL: ModelKind = {
  table: "publishers",
  keys: [["id"], ["name"], ["url"], ["dns_txt_value"]],
  expand: [
    {
      field: "organization",
      model: USER_MODEL, // TODO: Replace with actual one
    },
  ],
  fields: ["id", "name", "url", "organization", "verified", "dns_txt_value"],
  getModel: () => Publisher,
  getInstance: (data) => new Publisher(data),
};

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
