import Joi from "joi";
import { INotExpandedResource } from "../common/INotExpandedResource";
import { Schema } from "../config/Schema";
import { ISerializedUser, USER_SCHEMA } from "./user";

export interface IDatabasePaymentMethod {
  id: string;
  type: string;
  data: any;
  user: string;
  stripe_id: string;
}

export interface ISerializedPaymentMethod {
  id: string;
  type: string;
  data: any;
  user: ISerializedUser | INotExpandedResource;
}

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
