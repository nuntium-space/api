import Joi from "joi";
import { INotExpandedResource } from "../common/INotExpandedResource";
import { ModelKind } from "../config/Model";
import { Schema } from "../config/Schema";
import { PaymentMethod } from "../models/PaymentMethod";
import { User } from "../models/User";
import { USER_MODEL, USER_SCHEMA } from "./user";

export interface IPaymentMethod {
  id: string;
  type: string;
  data: any;
  user: User | INotExpandedResource;
  stripe_id: string;
}

export const PAYMENT_METHOD_MODEL: ModelKind = {
  table: "payment_methods",
  keys: [["id"], ["stripe_id"]],
  expand: [
    {
      field: "user",
      model: USER_MODEL,
    },
  ],
  fields: ["id", "type", "data", "user", "stripe_id"],
  serialization: {
    include: ["id", "type", "data", "user"],
  },
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
