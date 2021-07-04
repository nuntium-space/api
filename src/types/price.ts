import Joi from "joi";
import { INotExpandedResource } from "../common/INotExpandedResource";
import { Schema } from "../config/Schema";
import { BUNDLE_SCHEMA, ISerializedBundle } from "./bundle";

export interface IDatabasePrice {
  id: string;
  amount: number;
  currency: string;
  bundle: string;
  active: boolean;
  stripe_price_id: string | null;
}

export interface ICreatePrice {
  amount: number;
  currency: string;
}

export interface IUpdatePrice {
  active?: boolean;
}

export interface ISerializedPrice {
  id: string;
  amount: number;
  currency: string;
  bundle: ISerializedBundle | INotExpandedResource;
  active: boolean;
}

export const PRICE_SCHEMA = {
  OBJ: Joi.object({
    id: Schema.ID.PRICE.required(),
    amount: Schema.MONEY.required(),
    currency: Schema.CURRENCY.required(),
    bundle: Joi.alternatives()
      .try(BUNDLE_SCHEMA.OBJ, Schema.NOT_EXPANDED_RESOURCE(Schema.ID.BUNDLE))
      .required(),
    active: Schema.BOOLEAN.required(),
  }),
  CREATE: Joi.object({
    amount: Schema.MONEY.required(),
    currency: Schema.CURRENCY.required(),
  }),
  UPDATE: Joi.object({
    active: Schema.BOOLEAN.optional(),
  }),
} as const;
