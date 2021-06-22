import Joi from "joi";
import { INotExpandedResource } from "../common/INotExpandedResource";
import { Schema } from "../config/Schema";
import { AUTHOR_SCHEMA, ISerializedAuthor } from "./author";
import { ICreateSource, SOURCE_SCHEMA } from "./source";

export interface IDatabaseArticleDraft
{
    id: string,
    title: string,
    content: any,
    author: string,
    status: string,
    created_at: Date,
    updated_at: Date,
}

export interface ICreateArticleDraft
{
    title: string,
    content: any,
    sources: ICreateSource[],
}

export interface IUpdateArticleDraft
{
    title?: string,
    content?: any,
    sources?: ICreateSource[],
}

export interface ISerializedArticleDraft
{
    id: string,
    title: string,
    content: any,
    author: ISerializedAuthor | INotExpandedResource,
    status: string,
    created_at: string,
    updated_at: string,
}

export const ARTICLE_DRAFT_SCHEMA = {
    OBJ: Joi.object({
        id: Schema.ID.ARTICLE.required(),
        title: Schema.STRING.max(50).required(),
        content: Schema.NULLABLE(Schema.ARTICLE_CONTENT).required(),
        author: Joi
            .alternatives()
            .try(
                AUTHOR_SCHEMA.OBJ,
                Schema.NOT_EXPANDED_RESOURCE(Schema.ID.AUTHOR),
            )
            .required(),
        status: Schema.STRING.required(),
        created_at: Schema.DATETIME.required(),
        updated_at: Schema.DATETIME.required(),
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
