import Joi from "joi";
import { INotExpandedResource } from "../common/INotExpandedResource";
import { Schema } from "../config/Schema";
import { ISerializedOrganization, ORGANIZATION_SCHEMA } from "./organization";

export interface IDatabaseBundle {
  id: string;
  name: string;
  organization: string;
  active: boolean;
  stripe_product_id: string | null;
}

export interface ICreateBundle {
  name: string;
}

export interface IUpdateBundle {
  name?: string;
  active?: boolean;
}

export interface ISerializedBundle {
  id: string;
  name: string;
  organization: ISerializedOrganization | INotExpandedResource;
  active: boolean;
}

export const BUNDLE_SCHEMA = {
  OBJ: Joi.object({
    id: Schema.ID.BUNDLE.required(),
    name: Schema.STRING.max(50).required(),
    organization: Joi.alternatives()
      .try(
        ORGANIZATION_SCHEMA.OBJ,
        Schema.NOT_EXPANDED_RESOURCE(Schema.ID.ORGANIZATION)
      )
      .required(),
    active: Schema.BOOLEAN.required(),
  }),
  CREATE: Joi.object({
    name: Schema.STRING.max(50).required(),
  }),
  UPDATE: Joi.object({
    name: Schema.STRING.max(50),
    active: Schema.BOOLEAN.optional(),
  }),
} as const;
