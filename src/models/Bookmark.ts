import Boom from "@hapi/boom";
import Joi from "joi";
import { INotExpandedResource } from "../common/INotExpandedResource";
import { ISerializable } from "../common/ISerializable";
import { Schema } from "../config/Schema";
import Database from "../utilities/Database";
import { Article, ISerializedArticle } from "./Article";
import { User } from "./User";

interface IDatabaseBookmark
{
    user: string,
    article: string,
    created_at: Date,
}

export interface ISerializedBookmark
{
    article: ISerializedArticle | INotExpandedResource,
    created_at: string,
}

export class Bookmark implements ISerializable<ISerializedBookmark>
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
                insert into "articles"
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

    public serialize(): ISerializedBookmark
    {
        return {
            article: this.article instanceof Article
                ? this.article.serialize()
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

    /////////////
    // SCHEMAS //
    /////////////

    public static readonly SCHEMA = {
        OBJ: Joi.object({
            article: Joi
                .alternatives()
                .try(
                    Article.SCHEMA.OBJ,
                    Schema.NOT_EXPANDED_RESOURCE(Schema.ID.ARTICLE),
                )
                .required(),
            created_at: Schema.DATETIME.required(),
        }),
        CREATE: Joi.object({
            article: Schema.ID.ARTICLE.required(),
        }),
    } as const;
}
