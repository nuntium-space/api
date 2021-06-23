import Boom from "@hapi/boom";
import { INotExpandedResource } from "../common/INotExpandedResource";
import { ISerializable } from "../common/ISerializable";
import { Config } from "../config/Config";
import { ISerializedArticle, IDatabaseArticle } from "../types/article";
import Database from "../utilities/Database";
import { Author } from "./Author";
import { Bookmark } from "./Bookmark";
import { Like } from "./Like";
import { Publisher } from "./Publisher";
import { User } from "./User";

export class Article implements ISerializable<Promise<ISerializedArticle>>
{
    private constructor
    (
        public readonly id: string,
        private _title: string,
        private _content: any,
        public readonly author: Author | INotExpandedResource,
        private _reading_time: number,
        public readonly view_count: number,
        public readonly like_count: number,
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

    public static async trending(expand?: string[]): Promise<Article[]>
    {
        const result = await Database.pool.query(
            `
            select
                *,
                (
                    ("like_count" * 0.2)
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

    public async serialize(options?: {
        for?: User | INotExpandedResource,
        /**
         * @default false
         */
        includeContent?: boolean,
        /**
         * @default false
         */
        includeMetadata?: boolean,
    }): Promise<ISerializedArticle>
    {
        options ??= {};
        options.includeContent ??= false;
        options.includeMetadata ??= false;

        if (options.includeMetadata && !options.for)
        {
            throw Boom.badImplementation();
        }

        const obj: ISerializedArticle = {
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

        if (options.includeMetadata)
        {
            obj.__metadata = {
                is_liked: await Like.existsWithUserAndArticle(
                    options.for instanceof User
                        ? options.for
                        : options.for!.id,
                    this,
                ),
                is_bookmarked: await Bookmark.existsWithUserAndArticle(
                    options.for instanceof User
                        ? options.for
                        : options.for!.id,
                    this,
                ),
            };
        }

        return obj;
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
            parseInt(data.like_count.toString()),
            data.created_at,
            data.updated_at,
        );
    }
}
