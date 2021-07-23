import Joi from "joi";
import { INotExpandedResource } from "../common/INotExpandedResource";
import { ModelKind } from "../config/Model";
import { Schema } from "../config/Schema";
import { Article } from "../models/Article";
import { Bookmark } from "../models/Bookmark";
import { User } from "../models/User";
import { ISerializedArticle, ARTICLE_SCHEMA, ARTICLE_MODEL } from "./article";
import { USER_MODEL } from "./user";

export interface IBookmark {
  user: User | INotExpandedResource;
  article: Article | INotExpandedResource;
  created_at: Date;
}

export interface IDatabaseBookmark {
  user: string;
  article: string;
  created_at: Date;
}

export interface ISerializedBookmark {
  article: ISerializedArticle | INotExpandedResource;
  created_at: string;
}

export const BOOKMARK_MODEL: ModelKind = {
  table: "bookmarks",
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
  fields: ["user", "article", "created_at"],
  getModel: () => Bookmark,
  getInstance: (data) => new Bookmark(data),
};

export const BOOKMARK_SCHEMA = {
  OBJ: Joi.object({
    article: Joi.alternatives()
      .try(ARTICLE_SCHEMA.OBJ, Schema.NOT_EXPANDED_RESOURCE(Schema.ID.ARTICLE))
      .required(),
    created_at: Schema.DATETIME.required(),
  }),
  CREATE: Joi.object({
    article: Schema.ID.ARTICLE.required(),
  }),
} as const;
