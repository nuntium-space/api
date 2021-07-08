import Joi from "joi";
import { INotExpandedResource } from "../common/INotExpandedResource";
import { Schema } from "../config/Schema";
import { BUNDLE_SCHEMA, ISerializedBundle } from "./bundle";

export type PriceBillingPeriod = "month" | "week" | "year";

export interface IDatabasePrice {
  id: string;
  amount: number;
  currency: string;
  billing_period: PriceBillingPeriod;
  bundle: string;
  active: boolean;
  stripe_price_id: string | null;
}

export interface ICreatePrice {
  amount: number;
  currency: string;
  billing_period: PriceBillingPeriod;
}

export interface IUpdatePrice {
  active?: boolean;
}

export interface ISerializedPrice {
  id: string;
  amount: number;
  currency: string;
  billing_period: PriceBillingPeriod;
  bundle: ISerializedBundle | INotExpandedResource;
  active: boolean;
}

export const PRICE_SCHEMA = {
  OBJ: Joi.object({
    id: Schema.ID.PRICE.required(),
    amount: Schema.MONEY.required(),
    currency: Schema.CURRENCY.required(),
    billing_period: Schema.STRING.valid("month", "week", "year").required(),
    bundle: Joi.alternatives()
      .try(BUNDLE_SCHEMA.OBJ, Schema.NOT_EXPANDED_RESOURCE(Schema.ID.BUNDLE))
      .required(),
    active: Schema.BOOLEAN.required(),
  }),
  CREATE: Joi.object({
    amount: Schema.MONEY.required(),
    currency: Schema.CURRENCY.required(),
    billing_period: Schema.STRING.valid("month", "week", "year").required(),
  }),
  UPDATE: Joi.object({
    active: Schema.BOOLEAN.optional(),
  }),
} as const;
