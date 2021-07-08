import Joi from "joi";
import { INotExpandedResource } from "../common/INotExpandedResource";
import { Schema } from "../config/Schema";
import { ISerializedPublisher, PUBLISHER_SCHEMA } from "./publisher";

export interface IDatabaseAuthorInvite {
  id: string;
  publisher: string;
  user_email: string;
  created_at: Date;
  expires_at: Date;
}

export interface ICreateAuthorInvite {
  email: string;
  publisher: string;
}

export interface ISerializedAuthorInvite {
  id: string;
  publisher: ISerializedPublisher | INotExpandedResource;
  user_email: string;
  created_at: string;
  expires_at: string;
}

export const AUTHOR_INVITE_SCHEMA = {
  OBJ: Joi.object({
    id: Schema.ID.AUTHOR_INVITE.required(),
    publisher: Joi.alternatives()
      .try(
        PUBLISHER_SCHEMA.OBJ,
        Schema.NOT_EXPANDED_RESOURCE(Schema.ID.PUBLISHER)
      )
      .required(),
    user_email: Schema.EMAIL.required(),
    created_at: Schema.DATETIME.required(),
    expires_at: Schema.DATETIME.required(),
  }),
  CREATE: Joi.object({
    email: Schema.EMAIL.required(),
  }),
} as const;
