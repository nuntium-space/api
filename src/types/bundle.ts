import Joi from "joi";
import { INotExpandedResource } from "../common/INotExpandedResource";
import { ModelKind } from "../config/Model";
import { Schema } from "../config/Schema";
import { Bundle } from "../models/Bundle";
import { Organization } from "../models/Organization";
import { ISerializedOrganization, ORGANIZATION_MODEL, ORGANIZATION_SCHEMA } from "./organization";

export interface IBundle {
  id: string;
  name: string;
  organization: Organization | INotExpandedResource;
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

export const BUNDLE_MODEL: ModelKind = {
  table: "bundles",
  keys: [["id"], ["name", "organization"], ["stripe_product_id"]],
  expand: [
    {
      field: "organization",
      model: ORGANIZATION_MODEL,
    },
  ],
  fields: ["id", "name", "organization", "active", "stripe_product_id"],
  getModel: () => Bundle,
  getInstance: (data) => new Bundle(data),
};

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
