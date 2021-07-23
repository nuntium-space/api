import Joi from "joi";
import { INotExpandedResource } from "../common/INotExpandedResource";
import { ModelKind } from "../config/Model";
import { Schema } from "../config/Schema";
import { Article } from "../models/Article";
import { Like } from "../models/Like";
import { User } from "../models/User";
import { ISerializedArticle, ARTICLE_SCHEMA, ARTICLE_MODEL } from "./article";
import { USER_MODEL } from "./user";

export interface ILike {
  user: User | INotExpandedResource;
  article: Article | INotExpandedResource;
}

export interface ISerializedLike {
  article: ISerializedArticle | INotExpandedResource;
}

export const LIKE_MODEL: ModelKind = {
  table: "likes",
  keys: [["user", "article"]],
  expand: [
    {
      field: "user",
      model: USER_MODEL,
    },
    {
      field: "article",
      model: ARTICLE_MODEL,
    },
  ],
  fields: ["user", "article"],
  serialization: {
    include: ["article"],
  },
  getModel: () => Like,
  getInstance: (data) => new Like(data),
};

export const LIKE_SCHEMA = {
  OBJ: Joi.object({
    article: Joi.alternatives()
      .try(ARTICLE_SCHEMA.OBJ, Schema.NOT_EXPANDED_RESOURCE(Schema.ID.ARTICLE))
      .required(),
  }),
  CREATE: Joi.object({
    article: Schema.ID.ARTICLE.required(),
  }),
} as const;
