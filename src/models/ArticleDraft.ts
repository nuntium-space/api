import Boom from "@hapi/boom";
import { INotExpandedResource } from "../common/INotExpandedResource";
import { ISerializable } from "../common/ISerializable";
import { Config } from "../config/Config";
import { ISerializedArticleDraft, ICreateArticleDraft, IUpdateArticleDraft, IDatabaseArticleDraft } from "../types/article-draft";
import Database from "../utilities/Database";
import Utilities from "../utilities/Utilities";
import { Article } from "./Article";
import { Author } from "./Author";
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
        public readonly article: Article | INotExpandedResource,
        private _status: string,
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

    public get status(): string
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

    public static async create(data: ICreateArticleDraft, author: Author, expand?: string[]): Promise<ArticleDraft>
    {
        const id = Utilities.id(Config.ID_PREFIXES.ARTICLE);

        const client = await Database.pool.connect();

        await client.query("begin");

        const result = await client
            .query(
                `
                insert into "article_drafts"
                    ("id", "title", "content", "author")
                values
                    ($1, $2, $3, $4)
                returning *
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

        await Source.createMultiple(data.sources, id, client);

        await client.query("commit");

        client.release();

        return ArticleDraft.deserialize(result.rows[0], expand);
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
            await Source.deleteAll(this.article);
            await Source.createMultiple(data.sources, this.id, client);
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
        // TODO
    }

    public static async forPublisher(publisher: Publisher, expand?: string[]): Promise<ArticleDraft[]>
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
        const article = expand?.includes("article")
            ? await Article.retrieve(
                data.article,
                expand
                    .filter(e => e.startsWith("article."))
                    .map(e => e.replace("article.", "")),
                )
            : { id: data.article };

        return new ArticleDraft(
            data.id,
            data.title,
            data.content,
            article,
            data.status,
            data.created_at,
            data.updated_at,
        );
    }
}
