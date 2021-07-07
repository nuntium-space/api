import Joi from "joi";
import { INotExpandedResource } from "../common/INotExpandedResource";
import { Schema } from "../config/Schema";
import { ARTICLE_SCHEMA, ISerializedArticle } from "./article";
import { ISerializedUser, USER_SCHEMA } from "./user";

export interface IDatabaseArticleReport {
  id: string;
  user: string,
  article: string;
  reason: string;
  created_at: Date;
}

export interface ICreateArticleReport {
  user: string,
  article: string;
  reason: string;
}

export interface ISerializedArticleReport {
  id: string;
  user: ISerializedUser | INotExpandedResource,
  article: ISerializedArticle | INotExpandedResource;
  reason: string;
  created_at: string;
}

export const ARTICLE_REPORT_SCHEMA = {
  OBJ: Joi.object({
    id: Schema.ID.ARTICLE_DRAFT.required(),
    author: Joi.alternatives()
      .try(USER_SCHEMA.OBJ, Schema.NOT_EXPANDED_RESOURCE(Schema.ID.USER))
      .required(),
    article: Joi.alternatives().try(
      ARTICLE_SCHEMA.OBJ,
      Schema.NOT_EXPANDED_RESOURCE(Schema.ID.ARTICLE)
    ).required(),
    reason: Schema.STRING.required(),
    created_at: Schema.DATETIME.required(),
  }),
  CREATE: Joi.object({
    reason: Schema.STRING.required(),
  }),
} as const;
