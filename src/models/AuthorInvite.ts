import Boom from "@hapi/boom";
import { INotExpandedResource } from "../common/INotExpandedResource";
import { ISerializable } from "../common/ISerializable";
import { Config } from "../config/Config";
import {
  ISerializedAuthorInvite,
  ICreateAuthorInvite,
  IDatabaseAuthorInvite,
} from "../types/author-invite";
import Database from "../utilities/Database";
import { Email } from "../utilities/Email";
import Utilities from "../utilities/Utilities";
import { Publisher } from "./Publisher";
import { User } from "./User";

export class AuthorInvite implements ISerializable<ISerializedAuthorInvite> {
  private constructor(
    public readonly id: string,
    public readonly publisher: Publisher | INotExpandedResource,
    public readonly user_email: string,
    public readonly created_at: Date,
    public readonly expires_at: Date
  ) {}

  //////////
  // CRUD //
  //////////

  public static async create(
    data: ICreateAuthorInvite
  ): Promise<INotExpandedResource> {
    const publisher = await Publisher.retrieve(data.publisher);

    const userExists = await User.existsWithEmail(data.email);

    if (userExists) {
      const user = await User.retrieveWithEmail(data.email);

      if (await user.isAuthorOfPublisher(publisher)) {
        throw Boom.conflict();
      }
    }

    const id = Utilities.id(Config.ID_PREFIXES.AUTHOR_INVITE);

    const expiresAt = new Date();
    expiresAt.setSeconds(
      expiresAt.getSeconds() + Config.AUTHOR_INVITE_DURATION_IN_SECONDS
    );

    const client = await Database.pool.connect();
    await client.query("begin");

    await Database.pool
      .query(
        `
        insert into "author_invites"
          ("id", "publisher", "user_email", "expires_at")
        values
          ($1, $2, $3, $4)
        returning *
        `,
        [id, publisher.id, data.email, expiresAt.toISOString()]
      )
      .catch(async () => {
        await client.query("rollback");

        throw Boom.badRequest();
      });

    await Email.send({
      to: data.email,
      type: userExists
        ? Email.TYPE.AUTHOR_INVITE
        : Email.TYPE.AUTHOR_INVITE_NO_USER,
      replace: {
        PUBLISHER_NAME: publisher.name,
        CLIENT_URL: Config.CLIENT_URL,
      },
    }).catch(async () => {
      await client.query("rollback");

      throw Boom.badRequest();
    });

    await client.query("commit");
    client.release();

    return { id };
  }

  public static async retrieve(
    id: string,
    expand?: string[]
  ): Promise<AuthorInvite> {
    const result = await Database.pool.query(
      `select * from "author_invites" where "id" = $1`,
      [id]
    );

    if (result.rowCount === 0) {
      throw Boom.notFound();
    }

    return AuthorInvite.deserialize(result.rows[0], expand);
  }

  public async delete(): Promise<void> {
    await Database.pool.query(`delete from "author_invites" where "id" = $1`, [
      this.id,
    ]);
  }

  ///////////////
  // UTILITIES //
  ///////////////

  public async accept(): Promise<void> {
    const user = await User.retrieveWithEmail(this.user_email);

    if (!user.full_name) {
      throw Boom.forbidden(undefined, [
        {
          field: "author",
          error: "errors.custom.author.invite.must_have_full_name",
        },
      ]);
    }

    const client = await Database.pool.connect();
    await client.query("begin");

    if (!this.hasExpired()) {
      await client.query(
        `
        insert into "authors"
          ("id", "user", "publisher")
        values
          ($1, $2, $3)
        `,
        [Utilities.id(Config.ID_PREFIXES.AUTHOR), user.id, this.publisher.id]
      );
    }

    await client.query(
      `
      delete from "author_invites"
      where "id" = $1
      `,
      [this.id]
    );

    await client.query("commit");
    client.release();

    if (this.hasExpired()) {
      throw Boom.resourceGone();
    }
  }

  public static async forPublisher(
    publisher: Publisher,
    expand?: string[]
  ): Promise<AuthorInvite[]> {
    const result = await Database.pool.query(
      `select * from "author_invites" where "publisher" = $1`,
      [publisher.id]
    );

    return Promise.all(
      result.rows.map((row) => AuthorInvite.deserialize(row, expand))
    );
  }

  public static async forUser(
    user: User,
    expand?: string[]
  ): Promise<AuthorInvite[]> {
    const result = await Database.pool.query(
      `select * from "author_invites" where "user_email" = $1`,
      [user.email]
    );

    return Promise.all(
      result.rows.map((row) => AuthorInvite.deserialize(row, expand))
    );
  }

  public hasExpired(): boolean {
    return this.expires_at < new Date();
  }

  ///////////////////
  // SERIALIZATION //
  ///////////////////

  public serialize(options?: {
    for?: User | INotExpandedResource;
  }): ISerializedAuthorInvite {
    return {
      id: this.id,
      publisher:
        this.publisher instanceof Publisher
          ? this.publisher.serialize({ for: options?.for })
          : this.publisher,
      user_email: this.user_email,
      created_at: this.created_at.toISOString(),
      expires_at: this.expires_at.toISOString(),
    };
  }

  private static async deserialize(
    data: IDatabaseAuthorInvite,
    expand?: string[]
  ): Promise<AuthorInvite> {
    const publisher = expand?.includes("publisher")
      ? await Publisher.retrieve(data.publisher)
      : { id: data.publisher };

    return new AuthorInvite(
      data.id,
      publisher,
      data.user_email,
      data.created_at,
      data.expires_at
    );
  }
}
