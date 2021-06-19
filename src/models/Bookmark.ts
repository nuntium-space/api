import Boom from "@hapi/boom";
import { INotExpandedResource } from "../common/INotExpandedResource";
import { ISerializable } from "../common/ISerializable";
import { ISerializedBookmark, IDatabaseBookmark } from "../types/bookmark";
import Database from "../utilities/Database";
import { Article } from "./Article";
import { User } from "./User";

export class Bookmark implements ISerializable<Promise<ISerializedBookmark>>
{
    private constructor
    (
        public readonly user: User | INotExpandedResource,
        public readonly article: Article | INotExpandedResource,
        public readonly created_at: Date,
    )
    {}

    //////////
    // CRUD //
    //////////

    public static async create(user: User | string, article: Article | string, expand?: string[]): Promise<Bookmark>
    {
        const result = await Database.pool
            .query(
                `
                insert into "bookmarks"
                    ("user", "article")
                values
                    ($1, $2)
                returning *
                `,
                [
                    user instanceof User
                        ? user.id
                        : user,
                    article instanceof Article
                        ? article.id
                        : article,
                ],
            )
            .catch(() =>
            {
                throw Boom.badImplementation();
            });

        return Bookmark.deserialize(result.rows[0], expand);
    }

    public static async retrieveWithUserAndArticle(user: User | string, article: Article | string, expand?: string[]): Promise<Bookmark>
    {
        const result = await Database.pool.query(
            `
            select *
            from "bookmarks"
            where
                "user" = $1
                and
                "article" = $2
            `,
            [
                user instanceof User
                    ? user.id
                    : user,
                article instanceof Article
                    ? article.id
                    : article,
            ],
        );

        if (result.rowCount === 0)
        {
            throw Boom.notFound();
        }

        return Bookmark.deserialize(result.rows[0], expand);
    }

    public async delete(): Promise<void>
    {
        await Database.pool
            .query(
                `
                delete from "bookmarks"
                where
                    "user" = $1
                    and
                    "article" = $2
                `,
                [
                    this.user.id,
                    this.article.id,
                ],
            );
    }

    ///////////////
    // UTILITIES //
    ///////////////

    public static async existsWithUserAndArticle(user: User | string, article: Article | string): Promise<boolean>
    {
        const result = await Database.pool.query(
            `
            select 1
            from "bookmarks"
            where
                "user" = $1
                and
                "article" = $2
            limit 1
            `,
            [
                user instanceof User
                    ? user.id
                    : user,
                article instanceof Article
                    ? article.id
                    : article,
            ],
        );

        return result.rows.length > 0;
    }

    public static async forUser(user: User | string, expand?: string[]): Promise<Bookmark[]>
    {
        const result = await Database.pool.query(
            `
            select *
            from "bookmarks"
            where "user" = $1
            `,
            [
                user instanceof User
                    ? user.id
                    : user,
            ],
        );

        return Promise.all(result.rows.map(row => Bookmark.deserialize(row, expand)));
    }

    ///////////////////
    // SERIALIZATION //
    ///////////////////

    public async serialize(): Promise<ISerializedBookmark>
    {
        return {
            article: this.article instanceof Article
                ? await this.article.serialize()
                : this.article,
            created_at: this.created_at.toISOString(),
        };
    }

    private static async deserialize(data: IDatabaseBookmark, expand?: string[]): Promise<Bookmark>
    {
        const user = expand?.includes("user")
            ? await User.retrieve(data.user)
            : { id: data.user };

        const article = expand?.includes("article")
            ? await Article.retrieve(
                data.article,
                expand
                    .filter(e => e.startsWith("article."))
                    .map(e => e.replace("article.", "")),
                )
            : { id: data.article };

        return new Bookmark(
            user,
            article,
            data.created_at,
        );
    }
}
