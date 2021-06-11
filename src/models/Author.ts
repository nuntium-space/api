import Boom from "@hapi/boom";
import Joi from "joi";
import { INotExpandedResource } from "../common/INotExpandedResource";
import { ISerializable } from "../common/ISerializable";
import { Config } from "../config/Config";
import { Schema } from "../config/Schema";
import { USER_SCHEMA, PUBLISHER_SCHEMA } from "../config/schemas";
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

export class Author implements ISerializable<ISerializedAuthor>
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

        const result = await Database.pool
            .query(
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
            )
            .catch(() =>
            {
                throw Boom.badRequest();
            });

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

    public async delete(): Promise<void>
    {
        await Database.pool.query(
            `delete from "authors" where "id" = $1`,
            [ this.id ],
        );
    }

    public static async forPublisher(publisher: Publisher, expand?: string[]): Promise<Author[]>
    {
        const result = await Database.pool.query(
            `select * from "authors" where "publisher" = $1`,
            [ publisher.id ],
        );

        return Promise.all(result.rows.map(row => Author.deserialize(row, expand)));
    }

    public static async forUser(user: User, expand?: string[]): Promise<Author[]>
    {
        const result = await Database.pool.query(
            `select * from "authors" where "user" = $1`,
            [ user.id ],
        );

        return Promise.all(result.rows.map(row => Author.deserialize(row, expand)));
    }

    public serialize(options?: {
        for?: User | INotExpandedResource,
    }): ISerializedAuthor
    {
        return {
            id: this.id,
            user: this.user instanceof User
                ? this.user.serialize({ for: options?.for })
                : this.user,
            publisher: this.publisher instanceof Publisher
                ? this.publisher.serialize({ for: options?.for })
                : this.publisher,
        };
    }

    private static async deserialize(data: IDatabaseAuthor, expand?: string[]): Promise<Author>
    {
        const user = expand?.includes("user")
            ? await User.retrieve(data.user)
            : { id: data.user };

        const publisher = expand?.includes("publisher")
            ? await Publisher.retrieve(data.publisher)
            : { id: data.publisher };

        return new Author(
            data.id,
            user,
            publisher,
        );
    }

    public static readonly SCHEMA = {
        OBJ: Joi.object({
            id: Schema.ID.AUTHOR.required(),
            user: Joi
                .alternatives()
                .try(
                    USER_SCHEMA,
                    Schema.NOT_EXPANDED_RESOURCE(Schema.ID.USER),
                )
                .required(),
            publisher: Joi
                .alternatives()
                .try(
                    PUBLISHER_SCHEMA,
                    Schema.NOT_EXPANDED_RESOURCE(Schema.ID.PUBLISHER),
                )
                .required(),
        }),
        CREATE: Joi.object({
            email: Schema.EMAIL.required(),
        }),
    } as const;
}
