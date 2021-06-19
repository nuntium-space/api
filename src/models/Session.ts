import Boom from "@hapi/boom";
import { INotExpandedResource } from "../common/INotExpandedResource";
import { ISerializable } from "../common/ISerializable";
import { Config } from "../config/Config";
import { ISerializedSession, IDatabaseSession } from "../types/session";
import Database from "../utilities/Database";
import Utilities from "../utilities/Utilities";
import { User } from "./User";

export class Session implements ISerializable<ISerializedSession>
{
    private constructor
    (
        private readonly _id: string,
        private readonly _user: User,
        private readonly _expires_at: Date,
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

    public get expires_at(): Date
    {
        return this._expires_at;
    }

    public static async create(user: User): Promise<Session>
    {
        const expires = new Date();
        expires.setSeconds(new Date().getSeconds() + Config.SESSION_DURATION_IN_SECONDS);

        const result = await Database.pool
            .query(
                `
                insert into "sessions"
                    ("id", "user", "expires_at")
                values
                    ($1, $2, $3)
                returning *
                `,
                [
                    Utilities.id(Config.ID_PREFIXES.SESSION),
                    user.id,
                    expires.toISOString(),
                ],
            )
            .catch(() =>
            {
                throw Boom.badRequest();
            });

        return Session.deserialize(result.rows[0]);
    }

    public static async retrieve(id: string): Promise<Session>
    {
        const result = await Database.pool.query(
            `select * from "sessions" where "id" = $1`,
            [ id ],
        );

        if (result.rowCount === 0)
        {
            throw Boom.notFound();
        }

        return Session.deserialize(result.rows[0]);
    }

    public async delete(): Promise<void>
    {
        await Database.pool.query(
            `delete from "sessions" where "id" = $1`,
            [ this.id ],
        );
    }

    public hasExpired(): boolean
    {
        return this.expires_at < new Date();
    }

    public serialize(options?: {
        for?: User | INotExpandedResource,
    }): ISerializedSession
    {
        return {
            id: this.id,
            user: this.user.serialize({ for: options?.for }),
            expires_at: this.expires_at.toISOString(),
        };
    }

    private static async deserialize(data: IDatabaseSession): Promise<Session>
    {
        const user = await User.retrieve(data.user);

        return new Session(
            data.id,
            user,
            data.expires_at,
        );
    }
}
