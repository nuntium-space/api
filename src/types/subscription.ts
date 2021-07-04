import Joi from "joi";
import { INotExpandedResource } from "../common/INotExpandedResource";
import { Schema } from "../config/Schema";
import { ISerializedPrice, PRICE_SCHEMA } from "./price";
import { ISerializedUser, USER_SCHEMA } from "./user";

export interface IDatabaseSubscription {
  id: string;
  status: string;
  user: string;
  price: string;
  current_period_end: Date;
  cancel_at_period_end: boolean;
  deleted: boolean;
  stripe_subscription_id: string;
}

export interface IUpdateSubscription {
  current_period_end?: number;
  cancel_at_period_end?: boolean;
}

export interface ISerializedSubscription {
  id: string;
  status: string;
  user: ISerializedUser | INotExpandedResource;
  price: ISerializedPrice | INotExpandedResource;
  current_period_end: string;
  cancel_at_period_end: boolean;
  deleted: boolean;
}

export const SUBSCRIPTION_SCHEMA = {
  OBJ: Joi.object({
    id: Schema.ID.SUBSCRIPTION.required(),
    status: Schema.STRING.required(),
    user: Joi.alternatives()
      .try(USER_SCHEMA.OBJ, Schema.NOT_EXPANDED_RESOURCE(Schema.ID.USER))
      .required(),
    price: Joi.alternatives()
      .try(PRICE_SCHEMA.OBJ, Schema.NOT_EXPANDED_RESOURCE(Schema.ID.PRICE))
      .required(),
    current_period_end: Schema.DATETIME.required(),
    cancel_at_period_end: Schema.BOOLEAN.required(),
    deleted: Schema.BOOLEAN.required(),
  }),
  CREATE: Joi.object({
    price: Schema.ID.PRICE.required(),
  }),
} as const;
