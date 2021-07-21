import Joi from "joi";
import { ModelKind } from "../config/Model";
import { Schema } from "../config/Schema";
import { Organization } from "../models/Organization";
import { User } from "../models/User";
import { ISerializedUser, USER_SCHEMA } from "./user";

export interface IOrganization {
  id: string;
  name: string;
  user: User;
  stripe_account_id: string;
  stripe_account_enabled: boolean;
}

export interface IDatabaseOrganization {
  id: string;
  name: string;
  user: string;
  stripe_account_id: string;
  stripe_account_enabled: boolean;
}

export interface ICreateOrganization {
  name: string;
}

export interface IUpdateOrganization {
  name?: string;
  stripe_account_enabled?: boolean;
}

export interface ISerializedOrganization {
  id: string;
  name: string;
  owner: ISerializedUser;
  stripe_account_enabled: boolean;
}

export const ORGANIZATION_MODEL: ModelKind = {
  table: "organizations",
  keys: [["id"], ["name"], ["stripe_account_id"]],
  expand: [],
  fields: ["id", "name", "user", "stripe_account_id", "stripe_account_enabled"],
  getModel: () => Organization,
  getInstance: (data) => new Organization(data),
};

export const ORGANIZATION_SCHEMA = {
  OBJ: Joi.object({
    id: Schema.ID.ORGANIZATION.required(),
    name: Schema.STRING.max(50).optional(), // Not sent to users other than the owner
    owner: USER_SCHEMA.OBJ.optional(), // Not sent to users other than the owner
    stripe_account_enabled: Schema.BOOLEAN.optional(), // Not sent to users other than the owner
  }),
  CREATE: Joi.object({
    name: Schema.STRING.max(50).required(),
  }),
  UPDATE: Joi.object({
    name: Schema.STRING.max(50),
  }),
} as const;
