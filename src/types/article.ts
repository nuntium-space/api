import Joi from "joi";
import { INotExpandedResource } from "../common/INotExpandedResource";
import { ModelKind } from "../config/Model";
import { Schema } from "../config/Schema";
import { Article } from "../models/Article";
import { Author } from "../models/Author";
import { AUTHOR_MODEL, AUTHOR_SCHEMA, ISerializedAuthor } from "./author";

export interface IArticle {
  id: string;
  title: string;
  content: string;
  author: Author | INotExpandedResource;
  reading_time: number;
  created_at: Date;
  updated_at: Date;
}

export interface ISerializedArticle {
  id: string;
  title: string;
  author: ISerializedAuthor | INotExpandedResource;
  reading_time: number;
  created_at: string;
  updated_at: string;
  __metadata?: {
    is_liked: boolean;
    is_bookmarked: boolean;
  };
}

export const ARTICLE_MODEL: ModelKind = {
  table: "articles",
  keys: [["id"]],
  expand: [
    {
      field: "author",
      model: AUTHOR_MODEL,
    },
  ],
  fields: [
    "id",
    "title",
    "content",
    "author",
    "reading_time",
    "created_at",
    "updated_at",
  ],
  getModel: () => Article,
  getInstance: (data) => new Article(data),
};

export const ARTICLE_SCHEMA = {
  OBJ: Joi.object({
    id: Schema.ID.ARTICLE.required(),
    title: Schema.STRING.max(50).required(),
    author: Joi.alternatives()
      .try(AUTHOR_SCHEMA.OBJ, Schema.NOT_EXPANDED_RESOURCE(Schema.ID.AUTHOR))
      .required(),
    reading_time: Joi.number().integer().min(0).required(),
    created_at: Schema.DATETIME.required(),
    updated_at: Schema.DATETIME.required(),
    __metadata: Joi.object({
      is_liked: Schema.BOOLEAN.required(),
      is_bookmarked: Schema.BOOLEAN.required(),
    }).optional(),
  }),
} as const;
