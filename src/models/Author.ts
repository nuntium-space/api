import Boom from "@hapi/boom";
import { INotExpandedResource } from "../common/INotExpandedResource";
import { ISerializable } from "../common/ISerializable";
import { ISerializedAuthor, IDatabaseAuthor } from "../types/author";
import Database from "../utilities/Database";
import { Publisher } from "./Publisher";
import { User } from "./User";

export class Author implements ISerializable<ISerializedAuthor> {
  public constructor(private readonly data: any) {}

  public get id(): string {
    return this.data.id;
  }

  public get user(): User | INotExpandedResource {
    return this.data.user;
  }

  public get publisher(): Publisher | INotExpandedResource {
    return this.data.publisher;
  }

  //////////
  // CRUD //
  //////////

  public static async retrieve(id: string, expand?: string[]): Promise<Author> {
    const result = await Database.pool.query(
      `select * from "authors" where "id" = $1`,
      [id]
    );

    if (result.rowCount === 0) {
      throw Boom.notFound();
    }

    return Author.deserialize(result.rows[0], expand);
  }

  public async delete(): Promise<void> {
    await Database.pool.query(`delete from "authors" where "id" = $1`, [
      this.id,
    ]);
  }

  ///////////////
  // UTILITIES //
  ///////////////

  public static async retrieveWithUserAndPublisher(
    user: User | string,
    publisher: Publisher | string,
    expand?: string[]
  ): Promise<Author> {
    const result = await Database.pool.query(
      `
      select *
      from "authors"
      where
        "user" = $1
        and
        "publisher" = $2
      limit 1
      `,
      [
        user instanceof User ? user.id : user,
        publisher instanceof Publisher ? publisher.id : publisher,
      ]
    );

    if (result.rowCount === 0) {
      throw Boom.notFound();
    }

    return Author.deserialize(result.rows[0], expand);
  }

  public static async forPublisher(
    publisher: Publisher,
    expand?: string[]
  ): Promise<Author[]> {
    const result = await Database.pool.query(
      `select * from "authors" where "publisher" = $1`,
      [publisher.id]
    );

    return Promise.all(
      result.rows.map((row) => Author.deserialize(row, expand))
    );
  }

  public static async forUser(
    user: User,
    expand?: string[]
  ): Promise<Author[]> {
    const result = await Database.pool.query(
      `select * from "authors" where "user" = $1`,
      [user.id]
    );

    return Promise.all(
      result.rows.map((row) => Author.deserialize(row, expand))
    );
  }

  ///////////////////
  // SERIALIZATION //
  ///////////////////

  public serialize(options?: {
    for?: User | INotExpandedResource;
  }): ISerializedAuthor {
    return {
      id: this.id,
      user:
        this.user instanceof User
          ? this.user.serialize({ for: options?.for })
          : this.user,
      publisher:
        this.publisher instanceof Publisher
          ? this.publisher.serialize({ for: options?.for })
          : this.publisher,
    };
  }

  private static async deserialize(
    data: IDatabaseAuthor,
    expand?: string[]
  ): Promise<Author> {
    const user = expand?.includes("user")
      ? await User.retrieve(data.user)
      : { id: data.user };

    const publisher = expand?.includes("publisher")
      ? await Publisher.retrieve(data.publisher)
      : { id: data.publisher };

    return new Author({
      id: data.id,
      user,
      publisher,
    });
  }
}
