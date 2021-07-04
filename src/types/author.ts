import Joi from "joi";
import { INotExpandedResource } from "../common/INotExpandedResource";
import { Schema } from "../config/Schema";
import { ISerializedPublisher, PUBLISHER_SCHEMA } from "./publisher";
import { ISerializedUser, USER_SCHEMA } from "./user";

export interface IDatabaseAuthor {
  id: string;
  user: string;
  publisher: string;
}

export interface ISerializedAuthor {
  id: string;
  user: ISerializedUser | INotExpandedResource;
  publisher: ISerializedPublisher | INotExpandedResource;
}

export const AUTHOR_SCHEMA = {
  OBJ: Joi.object({
    id: Schema.ID.AUTHOR.required(),
    user: Joi.alternatives()
      .try(USER_SCHEMA.OBJ, Schema.NOT_EXPANDED_RESOURCE(Schema.ID.USER))
      .required(),
    publisher: Joi.alternatives()
      .try(
        PUBLISHER_SCHEMA.OBJ,
        Schema.NOT_EXPANDED_RESOURCE(Schema.ID.PUBLISHER)
      )
      .required(),
  }),
} as const;
