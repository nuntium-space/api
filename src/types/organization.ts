import Joi from "joi";
import { INotExpandedResource } from "../common/INotExpandedResource";
import { ModelKind } from "../config/Model";
import { Schema } from "../config/Schema";
import { Organization } from "../models/Organization";
import { User } from "../models/User";
import { USER_MODEL, USER_SCHEMA } from "./user";

export interface IOrganization {
  id: string;
  name: string;
  user: User | INotExpandedResource;
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

export const ORGANIZATION_MODEL: ModelKind = {
  table: "organizations",
  keys: [["id"], ["name"], ["stripe_account_id"]],
  expand: [
    {
      field: "user",
      model: USER_MODEL,
    },
  ],
  fields: ["id", "name", "user", "stripe_account_id", "stripe_account_enabled"],
  serialization: {
    include: ["id", "name", "user", "stripe_account_enabled"],
    custom: {
      name: {
        if: (organization, options) => {
          return (
            organization.instance<Organization>().user.id === options.for?.id
          );
        },
      },
      user: {
        if: (organization, options) => {
          return (
            organization.instance<Organization>().user.id === options.for?.id
          );
        },
      },
      stripe_account_enabled: {
        if: (organization, options) => {
          return (
            organization.instance<Organization>().user.id === options.for?.id
          );
        },
      },
    },
  },
  getModel: () => Organization,
  getInstance: (data) => new Organization(data),
};

export const ORGANIZATION_SCHEMA = {
  OBJ: Joi.object({
    id: Schema.ID.ORGANIZATION.required(),
    name: Schema.STRING.max(50).optional(), // Not sent to users other than the owner
    user: Joi.alternatives(
      USER_SCHEMA.OBJ,
      Schema.NOT_EXPANDED_RESOURCE(Schema.ID.USER)
    ).optional(), // Not sent to users other than the owner
    stripe_account_enabled: Schema.BOOLEAN.optional(), // Not sent to users other than the owner
  }),
  CREATE: Joi.object({
    name: Schema.STRING.max(50).required(),
  }),
  UPDATE: Joi.object({
    name: Schema.STRING.max(50),
  }),
} as const;
