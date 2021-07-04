import Joi from "joi";
import { INotExpandedResource } from "../common/INotExpandedResource";
import { Schema } from "../config/Schema";
import { ISerializedArticle, ARTICLE_SCHEMA } from "./article";

export interface IDatabaseBookmark {
  user: string;
  article: string;
  created_at: Date;
}

export interface ISerializedBookmark {
  article: ISerializedArticle | INotExpandedResource;
  created_at: string;
}

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
