import Joi from "joi";
import { INotExpandedResource } from "../common/INotExpandedResource";
import { ModelKind } from "../config/Model";
import { Schema } from "../config/Schema";
import { PaymentMethod } from "../models/PaymentMethod";
import { User } from "../models/User";
import { ISerializedUser, USER_MODEL, USER_SCHEMA } from "./user";

export interface IPaymentMethod {
  id: string;
  type: string;
  data: any;
  user: User | INotExpandedResource;
  stripe_id: string;
}

export interface ISerializedPaymentMethod {
  id: string;
  type: string;
  data: any;
  user: ISerializedUser | INotExpandedResource;
}

export const PAYMENT_METHOD_MODEL: ModelKind = {
  table: "payment_methods",
  keys: [["id", "stripe_id"]],
  expand: [
    {
      field: "user",
      model: USER_MODEL,
    },
  ],
  fields: ["id", "type", "data", "user", "stripe_id"],
  getModel: () => PaymentMethod,
  getInstance: (data) => new PaymentMethod(data),
};

export const PAYMENT_METHOD_SCHEMA = {
  OBJ: Joi.object({
    id: Schema.ID.PAYMENT_METHOD.required(),
    type: Schema.STRING.required(),
    data: Joi.object().required(),
    user: Joi.alternatives()
      .try(USER_SCHEMA.OBJ, Schema.NOT_EXPANDED_RESOURCE(Schema.ID.USER))
      .required(),
    __metadata: Joi.object({
      is_default: Schema.BOOLEAN.required(),
    }),
  }),
} as const;
