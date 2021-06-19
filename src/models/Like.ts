import Boom from "@hapi/boom";
import { INotExpandedResource } from "../common/INotExpandedResource";
import { ISerializable } from "../common/ISerializable";
import { IDatabaseLike, ISerializedLike } from "../types/like";
import Database from "../utilities/Database";
import { Article } from "./Article";
import { User } from "./User";

export class Like implements ISerializable<Promise<ISerializedLike>>
{
    private constructor
    (
        public readonly user: User | INotExpandedResource,
        public readonly article: Article | INotExpandedResource,
    )
    {}

    //////////
    // CRUD //
    //////////

    public static async create(user: User | string, article: Article | string, expand?: string[]): Promise<Like>
    {
        const result = await Database.pool
            .query(
                `
                insert into "likes"
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

        return Like.deserialize(result.rows[0], expand);
    }

    public static async retrieveWithUserAndArticle(user: User | string, article: Article | string, expand?: string[]): Promise<Like>
    {
        const result = await Database.pool.query(
            `
            select *
            from "likes"
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

        return Like.deserialize(result.rows[0], expand);
    }

    public async delete(): Promise<void>
    {
        await Database.pool
            .query(
                `
                delete from "likes"
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
            from "likes"
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

    public static async forUser(user: User | string, expand?: string[]): Promise<Like[]>
    {
        const result = await Database.pool.query(
            `
            select *
            from "likes"
            where "user" = $1
            `,
            [
                user instanceof User
                    ? user.id
                    : user,
            ],
        );

        return Promise.all(result.rows.map(row => Like.deserialize(row, expand)));
    }

    ///////////////////
    // SERIALIZATION //
    ///////////////////

    public async serialize(): Promise<ISerializedLike>
    {
        return {
            article: this.article instanceof Article
                ? await this.article.serialize()
                : this.article,
        };
    }

    private static async deserialize(data: IDatabaseLike, expand?: string[]): Promise<Like>
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

        return new Like(
            user,
            article,
        );
    }
}
