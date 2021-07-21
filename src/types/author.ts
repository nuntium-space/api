import Joi from "joi";
import { INotExpandedResource } from "../common/INotExpandedResource";
import { ModelKind } from "../config/Model";
import { Schema } from "../config/Schema";
import { Author } from "../models/Author";
import { ISerializedPublisher, PUBLISHER_SCHEMA } from "./publisher";
import { ISerializedUser, USER_MODEL, USER_SCHEMA } from "./user";

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

export const AUTHOR_MODEL: ModelKind = {
  table: "accounts",
  keys: [["id"], ["user", "publisher"]],
  expand: [
    {
      field: "user",
      model: USER_MODEL,
    },
    {
      field: "publisher",
      model: PUBLISHER_MODEL,
    },
  ],
  fields: ["id", "user", "publisher"],
  getModel: () => Author,
  getInstance: (data) => new Author(data),
};

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
