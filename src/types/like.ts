import Joi from "joi";
import { INotExpandedResource } from "../common/INotExpandedResource";
import { Schema } from "../config/Schema";
import { ISerializedArticle, ARTICLE_SCHEMA } from "./article";

export interface IDatabaseLike
{
    user: string,
    article: string,
}

export interface ISerializedLike
{
    article: ISerializedArticle | INotExpandedResource,
}

export const LIKE_SCHEMA = {
    OBJ: Joi.object({
        article: Joi
            .alternatives()
            .try(
                ARTICLE_SCHEMA.OBJ,
                Schema.NOT_EXPANDED_RESOURCE(Schema.ID.ARTICLE),
            )
            .required(),
    }),
    CREATE: Joi.object({
        article: Schema.ID.ARTICLE.required(),
    }),
} as const;
