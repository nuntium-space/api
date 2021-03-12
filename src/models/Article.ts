import readingTime from "reading-time";
import { INotExpandedResource } from "../common/INotExpandedResource";
import { Config } from "../config/Config";
import Database from "../utilities/Database";
import Utilities from "../utilities/Utilities";
import { Author, ISerializedAuthor } from "./Author";
import { Publisher } from "./Publisher";

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
        const client = await Database.pool.connect();

        const result = await client.query(
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
        );

        if (result.rowCount === 0)
        {
            throw new Error("Cannot create article");
        }

        return Article.deserialize(result.rows[0], expand);
    }

    public static async retrieve(id: string, expand?: string[]): Promise<Article | null>
    {
        const client = await Database.pool.connect();

        const result = await client.query(
            `select * from "articles" where "id" = $1`,
            [ id ],
        );

        if (result.rowCount === 0)
        {
            return null;
        }

        return Article.deserialize(result.rows[0], expand);
    }

    public async update(data: IUpdateArticle): Promise<void>
    {
        this._title = data.title ?? this.title;
        this._content = data.content ?? this.content;

        const client = await Database.pool.connect();

        const result = await client.query(
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
        const client = await Database.pool.connect();

        const result = await client.query(
            `delete from "articles" where "id" = $1`,
            [ this.id ],
        );

        if (result.rowCount === 0)
        {
            throw new Error("Cannot delete article");
        }
    }

    public static async forPublisher(publisher: Publisher, expand?: string[]): Promise<Article[]>
    {
        const client = await Database.pool.connect();

        const result = await client.query(
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
        let author: Author | INotExpandedResource;

        if (expand?.includes("author"))
        {
            const temp = await Author.retrieve(
                data.author,
                expand
                    .filter(e => e.startsWith("author."))
                    .map(e => e.replace("author.", "")),
            );

            if (!temp)
            {
                throw new Error(`The author '${data.author}' does not exist`);
            }

            author = temp;
        }
        else
        {
            author = { id: data.author };
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
