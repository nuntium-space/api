import Joi from "joi";
import { INotExpandedResource } from "../common/INotExpandedResource";
import { Config } from "../config/Config";
import { ModelKind } from "../config/Model";
import { Schema } from "../config/Schema";
import { Account } from "../models/Account";
import { User } from "../models/User";
import { USER_MODEL } from "./user";

export interface IAccount {
  id: string;
  user: User | INotExpandedResource;
  type: string;
  external_id: string;
}

export interface ICreateAccount {
  user: User | INotExpandedResource | string;
  type: string;
  external_id: string;
}

export const ACCOUNT_MODEL: ModelKind = {
  table: "accounts",
  keys: [["id"], ["user", "type"], ["type", "external_id"]],
  expand: [
    {
      field: "user",
      model: USER_MODEL,
    },
  ],
  fields: ["id", "user", "type", "external_id"],
  getModel: () => Account,
  getInstance: (data) => new Account(data),
};

export const ACCOUNT_SCHEMA = {
  OBJ: Joi.object({
    id: Schema.STRING.valid(
      ...Config.AUTH_PROVIDERS.map((_) => _.id)
    ).required(),
    display_name: Schema.STRING.valid(
      ...Config.AUTH_PROVIDERS.map((_) => _.display_name)
    ).required(),
    is_linked: Schema.BOOLEAN.required(),
  }),
} as const;
