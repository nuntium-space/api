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
    user: string,
    publisher: string,
}

export interface ISerializedAuthor
{
    id: string,
    user: ISerializedUser,
    publisher: ISerializedPublisher,
}

export class Author
{
    private constructor
    (
        private readonly _id: string,
        private _user: User,
        private  _publisher: Publisher,
    )
    {}

    public get id(): string
    {
        return this._id;
    }

    public get user(): User
    {
        return this._user;
    }

    public get publisher(): Publisher
    {
        return this._publisher;
    }

    public static async create(data: ICreateAuthor): Promise<Author>
    {
        const result = await Database.client.query(
            `
            insert into "authors"
                ("id", "user", "publisher")
            values
                ($1, $2, $3)
            returning *
            `,
            [
                Utilities.id(Config.ID_PREFIXES.AUTHOR),
                data.user,
                data.publisher,
            ],
        );

        if (result.rowCount === 0)
        {
            throw new Error("Cannot create author");
        }

        return Author.deserialize(result.rows[0]);
    }

    public static async retrieve(id: string): Promise<Author | null>
    {
        const result = await Database.client.query(
            `select * from "authors" where "id" = $1`,
            [ id ],
        );

        if (result.rowCount === 0)
        {
            return null;
        }

        return Author.deserialize(result.rows[0]);
    }

    public async delete(): Promise<void>
    {
        const result = await Database.client.query(
            `delete from "authors" where "id" = $1`,
            [ this.id ],
        );

        if (result.rowCount === 0)
        {
            throw new Error("Cannot delete author");
        }
    }

    public static async forPublisher(publisher: Publisher): Promise<Author[]>
    {
        const result = await Database.client.query(
            `select * from "authors" where "publisher" = $1`,
            [ publisher.id ],
        );

        return Promise.all(result.rows.map(Author.deserialize));
    }

    public serialize(): ISerializedAuthor
    {
        return {
            id: this.id,
            user: this.user.serialize(),
            publisher: this.publisher.serialize(),
        };
    }

    private static async deserialize(data: IDatabaseAuthor): Promise<Author>
    {
        const user = await User.retrieve(data.user);

        if (!user)
        {
            throw new Error(`The user '${data.user}' does not exist`);
        }

        const publisher = await Publisher.retrieve(data.publisher);

        if (!publisher)
        {
            throw new Error(`The publisher '${data.publisher}' does not exist`);
        }

        return new Author(
            data.id,
            user,
            publisher,
        );
    }
}
