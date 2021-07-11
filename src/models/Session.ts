import Boom from "@hapi/boom";
import { INotExpandedResource } from "../common/INotExpandedResource";
import { ISerializable } from "../common/ISerializable";
import { Config } from "../config/Config";
import { ISerializedSession, IDatabaseSession } from "../types/session";
import Database from "../utilities/Database";
import Utilities from "../utilities/Utilities";
import { User } from "./User";

export class Session implements ISerializable<ISerializedSession> {
  private constructor(
    public readonly id: string,
    public readonly user: User,
    public readonly expires_at: Date
  ) {}

  public static async create(
    user: User | INotExpandedResource | string
  ): Promise<INotExpandedResource> {
    const id = Utilities.id(Config.ID_PREFIXES.SESSION);

    const expiresAt = new Date();
    expiresAt.setSeconds(
      expiresAt.getSeconds() + Config.SESSION_DURATION_IN_SECONDS
    );

    await Database.pool
      .query(
        `
        insert into "sessions"
          ("id", "user", "expires_at")
        values
          ($1, $2, $3)
        `,
        [id, typeof user === "string" ? user : user.id, expiresAt.toISOString()]
      )
      .catch(() => {
        throw Boom.badRequest();
      });

    return { id };
  }

  public static async retrieve(id: string): Promise<Session> {
    const result = await Database.pool.query(
      `select * from "sessions" where "id" = $1`,
      [id]
    );

    if (result.rowCount === 0) {
      throw Boom.notFound();
    }

    return Session.deserialize(result.rows[0]);
  }

  public async delete(): Promise<void> {
    await Database.pool.query(`delete from "sessions" where "id" = $1`, [
      this.id,
    ]);
  }

  public hasExpired(): boolean {
    return this.expires_at < new Date();
  }

  public serialize(options?: {
    for?: User | INotExpandedResource;
  }): ISerializedSession {
    return {
      id: this.id,
      user: this.user.serialize({ for: options?.for }),
      expires_at: this.expires_at.toISOString(),
    };
  }

  private static async deserialize(data: IDatabaseSession): Promise<Session> {
    const user = await User.retrieve(data.user);

    return new Session(data.id, user, data.expires_at);
  }
}
