import Boom from "@hapi/boom";
import { INotExpandedResource } from "../common/INotExpandedResource";
import { Config } from "../config/Config";
import Database from "../utilities/Database";
import Utilities from "../utilities/Utilities";
import { ISerializedPublisher, Publisher } from "./Publisher";
import { ISerializedUser, User } from "./User";

interface IDatabaseAuthor
{
    id: string,
    user: string,
    publisher: string,
}

interface ICreateAuthor
{
    email: string,
    publisher: string,
}

export interface ISerializedAuthor
{
    id: string,
    user: ISerializedUser | INotExpandedResource,
    publisher: ISerializedPublisher | INotExpandedResource,
}

export class Author
{
    private constructor
    (
        private readonly _id: string,
        private _user: User | INotExpandedResource,
        private  _publisher: Publisher | INotExpandedResource,
    )
    {}

    public get id(): string
    {
        return this._id;
    }

    public get user(): User | INotExpandedResource
    {
        return this._user;
    }

    public get publisher(): Publisher | INotExpandedResource
    {
        return this._publisher;
    }

    public static async create(data: ICreateAuthor, expand?: string[]): Promise<Author>
    {
        const user = await User.retrieveWithEmail(data.email);

        const result = await Database.pool.query(
            `
            insert into "authors"
                ("id", "user", "publisher")
            values
                ($1, $2, $3)
            returning *
            `,
            [
                Utilities.id(Config.ID_PREFIXES.AUTHOR),
                user.id,
                data.publisher,
            ],
        );

        if (result.rowCount === 0)
        {
            throw new Error("Cannot create author");
        }

        return Author.deserialize(result.rows[0], expand);
    }

    public static async retrieve(id: string, expand?: string[]): Promise<Author>
    {
        const result = await Database.pool.query(
            `select * from "authors" where "id" = $1`,
            [ id ],
        );

        if (result.rowCount === 0)
        {
            throw Boom.notFound();
        }

        return Author.deserialize(result.rows[0], expand);
    }

    public static async retrieveWithUserAndPublisher(user: User, publisher: Publisher, expand?: string[]): Promise<Author>
    {
        const result = await Database.pool.query(
            `select * from "authors" where "user" = $1 and "publisher" = $2`,
            [ user.id, publisher.id ],
        );

        if (result.rowCount === 0)
        {
            throw Boom.notFound();
        }

        return Author.deserialize(result.rows[0], expand);
    }

    public async delete(): Promise<void>
    {
        const result = await Database.pool.query(
            `delete from "authors" where "id" = $1`,
            [ this.id ],
        );

        if (result.rowCount === 0)
        {
            throw new Error("Cannot delete author");
        }
    }

    public static async forPublisher(publisher: Publisher, expand?: string[]): Promise<Author[]>
    {
        const result = await Database.pool.query(
            `select * from "authors" where "publisher" = $1`,
            [ publisher.id ],
        );

        return Promise.all(result.rows.map(row => Author.deserialize(row, expand)));
    }

    public serialize(): ISerializedAuthor
    {
        return {
            id: this.id,
            user: this.user instanceof User
                ? this.user.serialize()
                : this.user,
            publisher: this.publisher instanceof Publisher
                ? this.publisher.serialize()
                : this.publisher,
        };
    }

    private static async deserialize(data: IDatabaseAuthor, expand?: string[]): Promise<Author>
    {
        const user = expand?.includes("user")
            ? await User.retrieve(data.user)
            : { id: data.user };

        let publisher: Publisher | INotExpandedResource;

        if (expand?.includes("publisher"))
        {
            const temp = await Publisher.retrieve(data.publisher);

            if (!temp)
            {
                throw new Error(`The publisher '${data.publisher}' does not exist`);
            }

            publisher = temp;
        }
        else
        {
            publisher = { id: data.publisher };
        }

        return new Author(
            data.id,
            user,
            publisher,
        );
    }
}
