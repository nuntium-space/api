import Boom from "@hapi/boom";
import { INotExpandedResource } from "../common/INotExpandedResource";
import { ISerializable } from "../common/ISerializable";
import { Config } from "../config/Config";
import { ISerializedArticleDraft, ICreateArticleDraft, IUpdateArticleDraft, IDatabaseArticleDraft, ArticleDraftStatus } from "../types/article-draft";
import Database from "../utilities/Database";
import Utilities from "../utilities/Utilities";
import { Article } from "./Article";
import { Author } from "./Author";
import { DraftSource } from "./DraftSource";
import { Publisher } from "./Publisher";
import { Source } from "./Source";
import { User } from "./User";

export class ArticleDraft implements ISerializable<Promise<ISerializedArticleDraft>>
{
    private constructor
    (
        public readonly id: string,
        private _title: string,
        private _content: any,
        public readonly author: Author | INotExpandedResource,
        public readonly article: Article | INotExpandedResource | null,
        private _status: ArticleDraftStatus,
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

    public get status(): ArticleDraftStatus
    {
        return this._status;
    }

    public get updated_at(): Date
    {
        return this._updated_at;
    }

    //////////
    // CRUD //
    //////////

    public static async create(data: ICreateArticleDraft, author: Author): Promise<INotExpandedResource>
    {
        const id = Utilities.id(Config.ID_PREFIXES.ARTICLE_DRAFT);

        const client = await Database.pool.connect();
        await client.query("begin");

        await client
            .query(
                `
                insert into "article_drafts"
                    ("id", "title", "content", "author")
                values
                    ($1, $2, $3, $4)
                `,
                [
                    id,
                    data.title,
                    data.content,
                    author.id,
                ],
            )
            .catch(async () =>
            {
                await client.query("rollback");

                throw Boom.badRequest();
            });

        await DraftSource.createMultiple(data.sources, id, client);

        await client.query("commit");
        client.release();

        return { id };
    }

    public static async createFromArticle(article: Article): Promise<INotExpandedResource>
    {
        const id = Utilities.id(Config.ID_PREFIXES.ARTICLE_DRAFT);

        const client = await Database.pool.connect();
        await client.query("begin");

        await client
            .query(
                `
                insert into "article_drafts"
                    ("id", "title", "content", "author", "article")
                values
                    ($1, $2, $3, $4, $5)
                `,
                [
                    id,
                    article.title,
                    article.content,
                    article.author.id,
                    article.id,
                ],
            )
            .catch(async () =>
            {
                await client.query("rollback");

                throw Boom.badRequest();
            });

        const sources = await Source.forArticle(article);
        await DraftSource.createMultiple(sources, id, client);

        await client.query("commit");
        client.release();

        return { id };
    }

    public static async retrieve(id: string, expand?: string[]): Promise<ArticleDraft>
    {
        const result = await Database.pool
            .query(
                `
                select *
                from "article_drafts"
                where "id" = $1
                `,
                [ id ],
            );

        if (result.rowCount === 0)
        {
            throw Boom.notFound();
        }

        return ArticleDraft.deserialize(result.rows[0], expand);
    }

    public async update(data: IUpdateArticleDraft): Promise<void>
    {
        if (this.status === "pending-verification")
        {
            throw Boom.forbidden();
        }

        this._title = data.title ?? this.title;
        this._content = data.content ?? this.content;

        const client = await Database.pool.connect();
        await client.query("begin");

        const result = await client
            .query(
                `
                update "article_drafts"
                set
                    "title" = $1,
                    "content" = $2
                where
                    "id" = $3
                returning "updated_at"
                `,
                [
                    this.title,
                    this.content,
                    this.id,
                ],
            )
            .catch(() =>
            {
                throw Boom.badRequest();
            });

        if (data.sources)
        {
            await DraftSource.deleteAll(this);
            await DraftSource.createMultiple(data.sources, this, client);
        }

        await client.query("commit");
        client.release();

        this._updated_at = result.rows[0].updated_at;
    }

    public async delete(): Promise<void>
    {
        await Database.pool
            .query(
                `
                delete from "article_drafts"
                where "id" = $1
                `,
                [ this.id ],
            );
    }

    ///////////////
    // UTILITIES //
    ///////////////

    public async submitForVerification(): Promise<void>
    {
        const client = await Database.pool.connect();
        await client.query("begin");

        const result = await client
            .query(
                `
                update "article_drafts"
                set "status" = 'pending-verification'
                where "id" = $1
                returning "updated_at"
                `,
                [ this.id ],
            )
            .catch(() =>
            {
                throw Boom.badRequest();
            });

        await client.query("commit");
        client.release();

        this._updated_at = result.rows[0].updated_at;
    }

    public async publish(): Promise<void>
    {
        const client = await Database.pool.connect();
        await client.query("begin");

        if (this.article === null)
        {
            const id = Utilities.id(Config.ID_PREFIXES.ARTICLE);

            await client
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
                        this.title,
                        this.content,
                        this.author.id,
                        Utilities.getArticleReadingTimeInMinutes(this.content),
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
                        title: this.title,
                        content: Utilities.extractTextFromEditorJson(this.content),
                    },
                })
                .catch(async () =>
                {
                    await client.query("rollback");

                    throw Boom.badImplementation();
                });
        }
        else
        {
            await client
                .query(
                    `
                    update "articles"
                    set
                        "title" = $1,
                        "content" = $2,
                        "reading_time" = $3,
                        "is_published" = true
                    where
                        "id" = $4
                    returning "updated_at"
                    `,
                    [
                        this.title,
                        this.content,
                        Utilities.getArticleReadingTimeInMinutes(this.content),
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
                    id: this.article.id,
                    body: {
                        title: this.title,
                        content: Utilities.extractTextFromEditorJson(this.content),
                    },
                })
                .catch(async () =>
                {
                    await client.query("rollback");

                    throw Boom.badImplementation();
                });
        }

        await client
            .query(
                `
                delete from "article_drafts"
                where "id" = $1
                `,
                [ this.id ],
            )
            .catch(async () =>
            {
                await client.query("rollback");

                throw Boom.badRequest();
            });

        await client.query("commit");
        client.release();
    }

    public static async forAuthor(author: Author, expand?: string[]): Promise<ArticleDraft[]>
    {
        const result = await Database.pool.query(
            `
            select *
            from "article_drafts"
            where "author" = $1
            order by "created_at" desc
            `,
            [ author.id ],
        );

        return Promise.all(result.rows.map(row => ArticleDraft.deserialize(row, expand)));
    }

    public static async forPublisher(publisher: Publisher, expand?: string[]): Promise<ArticleDraft[]>
    {
        const result = await Database.pool.query(
            `
            select "art".*
            from
                "article_drafts" as "art"
                inner join
                "authors" as "aut"
                on
                    "art"."author" = "aut"."id"
                    and
                    "aut"."publisher" = $1
            order by "created_at" desc
            `,
            [ publisher.id ],
        );

        return Promise.all(result.rows.map(row => ArticleDraft.deserialize(row, expand)));
    }

    ///////////////////
    // SERIALIZATION //
    ///////////////////

    public async serialize(options?: {
        for?: User | INotExpandedResource,
        /**
         * @default false
         */
        includeContent?: boolean,
    }): Promise<ISerializedArticleDraft>
    {
        options ??= {};
        options.includeContent ??= false;

        return {
            id: this.id,
            title: this.title,
            content: options.includeContent
                ? this.content
                : null,
            author: this.author instanceof Author
                ? this.author.serialize({ for: options.for })
                : this.author,
            article: this.article instanceof Article
                ? await this.article.serialize({ for: options.for })
                : this.article,
            status: this.status,
            created_at: this.created_at.toISOString(),
            updated_at: this.updated_at.toISOString(),
        };
    }

    private static async deserialize(data: IDatabaseArticleDraft, expand?: string[]): Promise<ArticleDraft>
    {
        let article: Article | INotExpandedResource | null = null;

        const author = expand?.includes("author")
            ? await Author.retrieve(data.author, Utilities.getNestedExpandQuery(expand, "author"))
            : { id: data.author };

        if (data.article)
        {
            article = expand?.includes("article")
                ? await Article.retrieve(data.article, Utilities.getNestedExpandQuery(expand, "article"))
                : { id: data.article };
        }

        return new ArticleDraft(
            data.id,
            data.title,
            data.content,
            author,
            article,
            data.status,
            data.created_at,
            data.updated_at,
        );
    }
}
