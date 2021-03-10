import { INotExpandedResource } from "../common/INotExpandedResource";
import { Config } from "../config/Config";
import Database from "../utilities/Database";
import Utilities from "../utilities/Utilities";
import { Article, ISerializedArticle } from "./Article";
import { ISerializedUser, User } from "./User";

interface IDatabaseComment
{
    id: string,
    content: string,
    user: string,
    article: string,
    parent: string,
    reply_count: number,
    created_at: Date,
    updated_at: Date,
}

interface ICreateComment
{
    content: string,
    user: string,
    article: string,
    parent: string,
}

interface IUpdateComment
{
    content?: string,
}

export interface ISerializedComment
{
    id: string,
    content: string,
    user: ISerializedUser | INotExpandedResource,
    article: ISerializedArticle | INotExpandedResource,
    parent: ISerializedComment | INotExpandedResource | null,
    reply_count: number,
    created_at: string,
    updated_at: string,
}

export class Comment
{
    private constructor
    (
        private readonly _id: string,
        private _content: string,
        private _user: User | INotExpandedResource,
        private _article: Article | INotExpandedResource,
        private _parent: Comment | INotExpandedResource | null,
        private _reply_count: number,
        private _created_at: Date,
        private _updated_at: Date,
    )
    {}

    public get id(): string
    {
        return this._id;
    }

    public get content(): string
    {
        return this._content;
    }

    public get user(): User | INotExpandedResource
    {
        return this._user;
    }

    public get article(): Article | INotExpandedResource
    {
        return this._article;
    }

    public get parent(): Comment | INotExpandedResource | null
    {
        return this._parent;
    }

    public get reply_count(): number
    {
        return this._reply_count;
    }

    public get created_at(): Date
    {
        return this._created_at;
    }

    public get updated_at(): Date
    {
        return this._updated_at;
    }

    public static async create(data: ICreateComment, expand?: string[]): Promise<Comment>
    {
        const result = await Database.client.query(
            `
            insert into "comments"
                ("id", "content", "user", "article", "parent")
            values
                ($1, $2, $3, $4, $5)
            returning *
            `,
            [
                Utilities.id(Config.ID_PREFIXES.COMMENT),
                data.content,
                data.user,
                data.article,
                data.parent,
            ],
        );

        if (result.rowCount === 0)
        {
            throw new Error("Cannot create comment");
        }

        return Comment.deserialize(result.rows[0], expand);
    }

    public static async retrieve(id: string, expand?: string[]): Promise<Comment | null>
    {
        const result = await Database.client.query(
            `select * from "v_comments" where "id" = $1`,
            [ id ],
        );

        if (result.rowCount === 0)
        {
            return null;
        }

        return Comment.deserialize(result.rows[0], expand);
    }

    public async update(data: IUpdateComment): Promise<void>
    {
        this._content = data.content ?? this.content;

        const result = await Database.client.query(
            `
            update "comments"
            set
                "content" = $1
            where
                "id" = $2
            returning "updated_at"
            `,
            [
                this.content,
                this.id,
            ],
        );

        if (result.rowCount === 0)
        {
            throw new Error("Cannot update comment");
        }

        this._updated_at = result.rows[0].updated_at;
    }

    public async delete(): Promise<void>
    {
        const result = await Database.client.query(
            `delete from "comments" where "id" = $1`,
            [ this.id ],
        );

        if (result.rowCount === 0)
        {
            throw new Error("Cannot delete comment");
        }
    }

    public static async forArticle(article: Article, options?: {
        parent?: string | null,
        expand?: string[],
    }): Promise<Comment[]>
    {
        const params = [ article.id ];

        if (typeof options?.parent === "string")
        {
            params.push(options.parent);
        }

        const result = await Database.client.query(
            `
            select *
            from "v_comments"
            where
                "article" = $1
                and
                "parent" ${typeof options?.parent === "string" ? "= $2" : "is null"}
            `,
            params,
        );

        return Promise.all(result.rows.map(row => Comment.deserialize(row, options?.expand)));
    }

    public serialize(): ISerializedComment
    {
        return {
            id: this.id,
            content: this.content,
            user: this.user instanceof User
                ? this.user.serialize()
                : this.user,
            article: this.article instanceof Article
                ? this.article.serialize()
                : this.article,
            parent: this.parent instanceof Comment
                ? this.parent.serialize()
                : this.parent,
            reply_count: this.reply_count,
            created_at: this.created_at.toISOString(),
            updated_at: this.updated_at.toISOString(),
        };
    }

    private static async deserialize(data: IDatabaseComment, expand?: string[]): Promise<Comment>
    {
        let article: Article | INotExpandedResource;
        let parent: Comment | INotExpandedResource | null = null;
        let user: User | INotExpandedResource;

        if (expand?.includes("article"))
        {
            const temp = await Article.retrieve(
                data.article,
                expand
                    .filter(e => e.startsWith("article."))
                    .map(e => e.replace("article.", "")),
            );

            if (!temp)
            {
                throw new Error(`The article '${data.article}' does not exist`);
            }

            article = temp;
        }
        else
        {
            article = { id: data.article };
        }

        if (data.parent !== null)
        {
            if (expand?.includes("parent"))
            {
                const temp = await Comment.retrieve(
                    data.parent,
                    expand
                        .filter(e => e.startsWith("parent."))
                        .map(e => e.replace("parent.", "")),
                );

                if (!temp)
                {
                    throw new Error(`The comment '${data.parent}' does not exist`);
                }

                parent = temp;
            }
            else
            {
                parent = { id: data.parent };
            }
        }

        if (expand?.includes("user"))
        {
            const temp = await User.retrieve(data.user);

            if (!temp)
            {
                throw new Error(`The user '${data.user}' does not exist`);
            }

            user = temp;
        }
        else
        {
            user = { id: data.user };
        }

        return new Comment(
            data.id,
            data.content,
            user,
            article,
            parent,
            parseInt((data.reply_count ?? 0).toString()),
            data.created_at,
            data.updated_at,
        );
    }
}
