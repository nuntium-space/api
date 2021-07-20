import Joi from "joi";
import { INotExpandedResource } from "../common/INotExpandedResource";
import { Config } from "../config/Config";
import { Schema } from "../config/Schema";
import { User } from "../models/User";

export interface IAccount {
  id: string;
  user: User | INotExpandedResource;
  type: string;
  external_id: string;
}

export interface IDatabaseAccount {
  id: string;
  user: string;
  type: string;
  external_id: string;
}

export interface ICreateAccount {
  user: User | INotExpandedResource | string;
  type: string;
  external_id: string;
}

export interface ISerializedAccount {
  id: string;
  display_name: string;
  is_linked: boolean;
}

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
