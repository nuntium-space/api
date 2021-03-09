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

interface ICommentExpandOptions
{
    user?: boolean,
    article?: boolean,
    parent?: boolean,
}

export interface ISerializedComment
{
    id: string,
    content: string,
    user: ISerializedUser | { id: string },
    article: ISerializedArticle | { id: string },
    parent: ISerializedComment | { id: string } | null,
    created_at: string,
    updated_at: string,
}

export class Comment
{
    private constructor
    (
        private readonly _id: string,
        private _content: string,
        private _user: User | { id: string },
        private _article: Article | { id: string },
        private _parent: Comment | { id: string } | null,
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

    public get user(): User | { id: string }
    {
        return this._user;
    }

    public get article(): Article | { id: string }
    {
        return this._article;
    }

    public get parent(): Comment | { id: string } | null
    {
        return this._parent;
    }

    public get created_at(): Date
    {
        return this._created_at;
    }

    public get updated_at(): Date
    {
        return this._updated_at;
    }

    public static async create(data: ICreateComment): Promise<Comment>
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

        return Comment.deserialize(result.rows[0]);
    }

    public static async retrieve(id: string, expand?: ICommentExpandOptions): Promise<Comment | null>
    {
        const result = await Database.client.query(
            `select * from "comments" where "id" = $1`,
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

    public static async forArticle(article: Article, expand?: ICommentExpandOptions): Promise<Comment[]>
    {
        const result = await Database.client.query(
            `select * from comments where "article" = $1`,
            [ article.id ],
        );

        return Promise.all(result.rows.map(row => Comment.deserialize(row, expand)));
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
            created_at: this.created_at.toISOString(),
            updated_at: this.updated_at.toISOString(),
        };
    }

    private static async deserialize(data: IDatabaseComment, expand?: ICommentExpandOptions): Promise<Comment>
    {
        let article: Article | { id: string };
        let parent: Comment | { id: string } | null;
        let user: User | { id: string };

        if (expand?.article)
        {
            const temp = await Article.retrieve(data.article);

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

        if (expand?.parent && data.parent !== null)
        {
            const temp = await Comment.retrieve(data.parent);

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

        if (expand?.user)
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
            data.created_at,
            data.updated_at,
        );
    }
}
