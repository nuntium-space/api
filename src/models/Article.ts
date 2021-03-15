import Boom from "@hapi/boom";
import readingTime from "reading-time";
import { INotExpandedResource } from "../common/INotExpandedResource";
import { Config } from "../config/Config";
import Database from "../utilities/Database";
import Utilities from "../utilities/Utilities";
import { Author, ISerializedAuthor } from "./Author";
import { Publisher } from "./Publisher";
import { User } from "./User";

interface IDatabaseArticle
{
    id: string,
    title: string,
    content: string,
    author: string,
    created_at: Date,
    updated_at: Date,
}

interface ICreateArticle
{
    title: string,
    content: string,
}

interface IUpdateArticle
{
    title?: string,
    content?: string,
}

export interface ISerializedArticle
{
    id: string,
    title: string,
    content: string,
    reading_time: number,
    author: ISerializedAuthor | INotExpandedResource,
    created_at: string,
    updated_at: string,
}

export class Article
{
    private constructor
    (
        private readonly _id: string,
        private _title: string,
        private _content: string,
        private _author: Author | INotExpandedResource,
        private _created_at: Date,
        private _updated_at: Date,
    )
    {}

    public get id(): string
    {
        return this._id;
    }

    public get title(): string
    {
        return this._title;
    }

    public get content(): string
    {
        return this._content;
    }

    public get author(): Author | INotExpandedResource
    {
        return this._author;
    }

    public get created_at(): Date
    {
        return this._created_at;
    }

    public get updated_at(): Date
    {
        return this._updated_at;
    }

    public static async create(data: ICreateArticle, author: Author, expand?: string[]): Promise<Article>
    {
        const result = await Database.pool
            .query(
                `
                insert into "articles"
                    ("id", "title", "content", "author")
                values
                    ($1, $2, $3, $4)
                returning *
                `,
                [
                    Utilities.id(Config.ID_PREFIXES.ARTICLE),
                    data.title,
                    data.content,
                    author.id,
                ],
            )
            .catch(() =>
            {
                throw Boom.badRequest();
            });

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

    public async update(data: IUpdateArticle): Promise<void>
    {
        this._title = data.title ?? this.title;
        this._content = data.content ?? this.content;

        const result = await Database.pool
            .query(
                `
                update "articles"
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

        this._updated_at = result.rows[0].updated_at;
    }

    public async delete(): Promise<void>
    {
        await Database.pool.query(
            `delete from "articles" where "id" = $1`,
            [ this.id ],
        );
    }

    public static async forFeed(user: User, options: {
        limit: number,
        offset: number,
        expand?: string[],
    }): Promise<Article[]>
    {
        const result = await Database.pool.query(
            `
            select distinct art.*
            from
                subscriptions as s
                inner join
                bundles_publishers as bp
                on s.bundle = bp.bundle
                inner join
                authors as aut
                on aut.publisher = bp.publisher
                inner join
                articles as art
                on art.author = aut.id
            where
                s.user = $1
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
            `,
            [ publisher.id ],
        );

        return Promise.all(result.rows.map(row => Article.deserialize(row, expand)));
    }

    public serialize(options?: { preview?: boolean }): ISerializedArticle
    {
        return {
            id: this.id,
            title: this.title,
            content: options?.preview && this.content.length > Config.ARTICLE_PREVIEW_LENGTH
                ? this.content.substr(0, Config.ARTICLE_PREVIEW_LENGTH) + "..."
                : this.content,
            reading_time: readingTime(this.content).minutes,
            author: this.author instanceof Author
                ? this.author.serialize()
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
            data.created_at,
            data.updated_at,
        );
    }
}
