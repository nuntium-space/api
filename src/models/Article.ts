import Boom from "@hapi/boom";
import Joi from "joi";
import { INotExpandedResource } from "../common/INotExpandedResource";
import { ISerializable } from "../common/ISerializable";
import { Config } from "../config/Config";
import { Schema } from "../config/Schema";
import Database from "../utilities/Database";
import Utilities from "../utilities/Utilities";
import { Author, ISerializedAuthor } from "./Author";
import { Publisher } from "./Publisher";
import { Source } from "./Source";
import { User } from "./User";

interface IDatabaseArticle
{
    id: string,
    title: string,
    content: any,
    author: string,
    reading_time: number,
    view_count: number,
    comment_count: number,
    created_at: Date,
    updated_at: Date,
}

interface ICreateArticle
{
    title: string,
    content: any,
}

interface IUpdateArticle
{
    title?: string,
    content?: any,
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
}

export class Article implements ISerializable<ISerializedArticle>
{
    private constructor
    (
        public readonly id: string,
        private _title: string,
        private _content: any,
        public readonly author: Author | INotExpandedResource,
        private _reading_time: number,
        public view_count: number,
        public comment_count: number,
        public readonly created_at: Date,
        private _updated_at: Date,
    )
    {}

    public get title(): string
    {
        return this._title;
    }

    public get content(): any
    {
        return this._content;
    }

    public get reading_time(): number
    {
        return this._reading_time;
    }

    public get updated_at(): Date
    {
        return this._updated_at;
    }

    //////////
    // CRUD //
    //////////

    public static async create(data: ICreateArticle, author: Author, expand?: string[]): Promise<Article>
    {
        const id = Utilities.id(Config.ID_PREFIXES.ARTICLE);

        const client = await Database.pool.connect();

        await client.query("begin");

        const result = await client
            .query(
                `
                insert into "articles"
                    ("id", "title", "content", "author", "reading_time")
                values
                    ($1, $2, $3, $4, $5)
                returning *
                `,
                [
                    id,
                    data.title,
                    data.content,
                    author.id,
                    Utilities.getArticleReadingTimeInMinutes(data.content),
                ],
            )
            .catch(async () =>
            {
                await client.query("rollback");

                throw Boom.badRequest();
            });

        await Config.ELASTICSEARCH
            .index({
                index: "articles",
                id,
                body: {
                    title: data.title,
                    content: Utilities.extractTextFromEditorJson(data.content),
                },
            })
            .catch(async () =>
            {
                await client.query("rollback");

                throw Boom.badImplementation();
            });

        await client.query("commit");

        client.release();

        return Article.deserialize(result.rows[0], expand);
    }

    public static async retrieve(id: string, expand?: string[]): Promise<Article>
    {
        const result = await Database.pool.query(
            `select * from "articles" where "id" = $1`,
            [ id ],
        );

        if (result.rowCount === 0)
        {
            throw Boom.notFound();
        }

        return Article.deserialize(result.rows[0], expand);
    }

    public static async retrieveMultiple(ids: string[], expand?: string[]): Promise<Article[]>
    {
        const result = await Database.pool.query(
            `select * from "articles" where "id" = any ($1) order by "created_at" desc`,
            [ ids ],
        );

        return Promise.all(result.rows.map(row => Article.deserialize(row, expand)));
    }

    public static async retrieveRecent(user: User, expand?: string[]): Promise<Article[]>
    {
        const result = await Database.pool.query(
            `
            with "recent_articles" as
            (
                select "a".*, max("av"."timestamp") as "last_viewed"
                from
                    "user_history" as "av"
                    inner join
                    "articles" as "a"
                    on "av"."article" = "a"."id"
                where "av"."user" = $1
                group by "a"."id"
            )
            select *
            from "recent_articles"
            order by "last_viewed" desc
            limit $2
            `,
            [
                user.id,
                Config.RECENT_ARTICLES_MAX_LENGTH,
            ],
        );

        return Promise.all(result.rows.map(row => Article.deserialize(row, expand)));
    }

    public static async trending(expand?: string[]): Promise<Article[]>
    {
        const result = await Database.pool.query(
            `
            select
                *,
                (
                    ("comment_count" * 0.2)
                    + ("view_count" * 0.1)
                )
                / (extract(day from current_timestamp - "created_at") * 0.5 + 1)
                    as "score"
            from "articles"
            group by "id"
            order by "score" desc
            limit $1
            `,
            [
                Config.TRENDING_ARTICLES_MAX_LENGTH,
            ],
        );

        return Promise.all(result.rows.map(row => Article.deserialize(row, expand)));
    }

    public async update(data: IUpdateArticle): Promise<void>
    {
        this._title = data.title ?? this.title;
        this._content = data.content ?? this.content;
        this._reading_time = Utilities.getArticleReadingTimeInMinutes(this.content);

        const client = await Database.pool.connect();

        await client.query("begin");

        const result = await client
            .query(
                `
                update "articles"
                set
                    "title" = $1,
                    "content" = $2,
                    "reading_time" = $3
                where
                    "id" = $4
                returning "updated_at"
                `,
                [
                    this.title,
                    this.content,
                    this.reading_time,
                    this.id,
                ],
            )
            .catch(() =>
            {
                throw Boom.badRequest();
            });

        await Config.ELASTICSEARCH
            .update({
                index: "articles",
                id: this.id,
                body: {
                    doc: {
                        title: this.title,
                        content: Utilities.extractTextFromEditorJson(this.content),
                    },
                },
            })
            .catch(async () =>
            {
                await client.query("rollback");

                throw Boom.badImplementation();
            });

        await client.query("commit");

        client.release();

        this._updated_at = result.rows[0].updated_at;
    }

    public async delete(): Promise<void>
    {
        const client = await Database.pool.connect();

        await client.query("begin");

        await client.query(
            `delete from "articles" where "id" = $1`,
            [ this.id ],
        );

        await Config.ELASTICSEARCH
            .delete({
                index: "articles",
                id: this.id,
            })
            .catch(async () =>
            {
                await client.query("rollback");

                throw Boom.badImplementation();
            });

        await client.query("commit");

        client.release();
    }

    ///////////////
    // UTILITIES //
    ///////////////

    public static async forFeed(user: User, options: {
        limit: number,
        offset: number,
        expand?: string[],
    }): Promise<Article[]>
    {
        const result = await Database.pool
            .query(
                `
                select
                    distinct on ("art"."created_at", "art"."id")
                    "art"."id", "art"."title", "art"."content", "art"."author", "art"."created_at", "art"."updated_at"
                from
                    "v_active_subscriptions" as "s"
                    inner join
                    "prices" as "p"
                    on "s"."price" = "p"."id"
                    inner join
                    "bundles_publishers" as "bp"
                    on "p"."bundle" = "bp"."bundle"
                    inner join
                    "authors" as "aut"
                    on "aut"."publisher" = "bp"."publisher"
                    inner join
                    "articles" as "art"
                    on "art"."author" = "aut"."id"
                where
                    "s"."user" = $1
                order by "art"."created_at", "art"."id" desc
                limit $2
                offset $3
                `,
                [
                    user.id,
                    options.limit,
                    options.offset,
                ],
            );

        return Promise.all(result.rows.map(row => Article.deserialize(row, options.expand)));
    }

    public static async forPublisher(publisher: Publisher, expand?: string[]): Promise<Article[]>
    {
        const result = await Database.pool.query(
            `
            select art.*
            from
                articles as art
                inner join
                authors as aut
                on
                    art.author = aut.id
                    and
                    aut.publisher = $1
            order by "created_at" desc
            `,
            [ publisher.id ],
        );

        return Promise.all(result.rows.map(row => Article.deserialize(row, expand)));
    }

    ///////////////////
    // SERIALIZATION //
    ///////////////////

    public serialize(options?: {
        for?: User | INotExpandedResource,
        /**
         * @default false
         */
        includeContent?: boolean,
    }): ISerializedArticle
    {
        options ??= {};
        options.includeContent ??= false;

        return {
            id: this.id,
            title: this.title,
            content: options.includeContent
                ? this.content
                : null,
            reading_time: this.reading_time,
            author: this.author instanceof Author
                ? this.author.serialize({ for: options.for })
                : this.author,
            created_at: this.created_at.toISOString(),
            updated_at: this.updated_at.toISOString(),
        };
    }

    private static async deserialize(data: IDatabaseArticle, expand?: string[]): Promise<Article>
    {
        const author = expand?.includes("author")
            ? await Author.retrieve(
                data.author,
                expand
                    .filter(e => e.startsWith("author."))
                    .map(e => e.replace("author.", "")),
                )
            : { id: data.author };

        return new Article(
            data.id,
            data.title,
            data.content,
            author,
            parseInt(data.reading_time.toString()),
            parseInt(data.view_count.toString()),
            parseInt(data.comment_count.toString()),
            data.created_at,
            data.updated_at,
        );
    }

    /////////////
    // SCHEMAS //
    /////////////

    public static readonly SCHEMA = {
        OBJ: Joi.object({
            id: Schema.ID.ARTICLE.required(),
            title: Schema.STRING.max(50).required(),
            content: Schema.NULLABLE(Schema.ARTICLE_CONTENT).required(),
            reading_time: Joi.number().integer().min(0).required(),
            author: Joi
                .alternatives()
                .try(
                    Author.SCHEMA.OBJ,
                    Schema.NOT_EXPANDED_RESOURCE(Schema.ID.AUTHOR),
                )
                .required(),
            created_at: Schema.DATETIME.required(),
            updated_at: Schema.DATETIME.required(),
        }),
        CREATE: Joi.object({
            title: Schema.STRING.max(50).required(),
            content: Schema.ARTICLE_CONTENT.required(),
            sources: Schema.ARRAY(Source.SCHEMA.CREATE).required(),
        }),
        UPDATE: Joi.object({
            title: Schema.STRING.max(50),
            content: Schema.ARTICLE_CONTENT,
        }),
    } as const;
}
