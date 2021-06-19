import Joi from "joi";
import { INotExpandedResource } from "../common/INotExpandedResource";
import { Schema } from "../config/Schema";
import { AUTHOR_SCHEMA, ISerializedAuthor } from "./author";
import { ICreateSource, SOURCE_SCHEMA } from "./source";

export interface IDatabaseArticle
{
    id: string,
    title: string,
    content: any,
    author: string,
    reading_time: number,
    view_count: number,
    like_count: number,
    created_at: Date,
    updated_at: Date,
}

export interface ICreateArticle
{
    title: string,
    content: any,
    sources: ICreateSource[],
}

export interface IUpdateArticle
{
    title?: string,
    content?: any,
    sources?: ICreateSource[],
}

export interface ISerializedArticle
{
    id: string,
    title: string,
    content: any,
    author: ISerializedAuthor | INotExpandedResource,
    reading_time: number,
    created_at: string,
    updated_at: string,
    __metadata?: {
        is_bookmarked: boolean,
    },
}

export const ARTICLE_SCHEMA = {
    OBJ: Joi.object({
        id: Schema.ID.ARTICLE.required(),
        title: Schema.STRING.max(50).required(),
        content: Schema.NULLABLE(Schema.ARTICLE_CONTENT).required(),
        reading_time: Joi.number().integer().min(0).required(),
        author: Joi
            .alternatives()
            .try(
                AUTHOR_SCHEMA.OBJ,
                Schema.NOT_EXPANDED_RESOURCE(Schema.ID.AUTHOR),
            )
            .required(),
        created_at: Schema.DATETIME.required(),
        updated_at: Schema.DATETIME.required(),
        __metadata: Joi.object({
            is_bookmarked: Schema.BOOLEAN.required(),
        }).optional(),
    }),
    CREATE: Joi.object({
        title: Schema.STRING.max(50).required(),
        content: Schema.ARTICLE_CONTENT.required(),
        sources: Schema.ARRAY(SOURCE_SCHEMA.CREATE).required(),
    }),
    UPDATE: Joi.object({
        title: Schema.STRING.max(50),
        content: Schema.ARTICLE_CONTENT,
    }),
} as const;