import { Config } from "../config/Config";
import Database from "../utilities/Database";
import Utilities from "../utilities/Utilities";
import { Author, ISerializedAuthor } from "./Author";

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
    author: string,
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
    author: ISerializedAuthor,
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
        private _author: Author,
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

    public get author(): Author
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

    public static async create(data: ICreateArticle): Promise<Article>
    {
        const result = await Database.client.query(
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
                data.author,
            ],
        );

        if (result.rowCount === 0)
        {
            throw new Error("Cannot create article");
        }

        return Article.deserialize(result.rows[0]);
    }

    public static async retrieve(id: string): Promise<Article | null>
    {
        const result = await Database.client.query(
            `select * from "articles" where "id" = $1`,
            [ id ],
        );

        if (result.rowCount === 0)
        {
            return null;
        }

        return Article.deserialize(result.rows[0]);
    }

    public async update(data: IUpdateArticle): Promise<void>
    {
        this._title = data.title ?? this.title;
        this._content = data.content ?? this.content;

        const result = await Database.client.query(
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
        );

        if (result.rowCount === 0)
        {
            throw new Error("Cannot update article");
        }

        this._updated_at = result.rows[0].updated_at;
    }

    public async delete(): Promise<void>
    {
        const result = await Database.client.query(
            `delete from "articles" where "id" = $1`,
            [ this.id ],
        );

        if (result.rowCount === 0)
        {
            throw new Error("Cannot delete article");
        }
    }

    public serialize(): ISerializedArticle
    {
        return {
            id: this.id,
            title: this.title,
            content: this.content,
            author: this.author.serialize(),
            created_at: this.created_at.toISOString(),
            updated_at: this.updated_at.toISOString(),
        };
    }

    private static async deserialize(data: IDatabaseArticle): Promise<Article>
    {
        const author = await Author.retrieve(data.author);

        if (!author)
        {
            throw new Error(`The author '${data.author}' does not exist`);
        }

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
