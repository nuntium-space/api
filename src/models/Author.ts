import Boom from "@hapi/boom";
import { INotExpandedResource } from "../common/INotExpandedResource";
import { ISerializable } from "../common/ISerializable";
import { Model } from "../config/Model";
import { ISerializedAuthor, IAuthor, AUTHOR_MODEL } from "../types/author";
import Database from "../utilities/Database";
import { Publisher } from "./Publisher";
import { User } from "./User";

export class Author extends Model implements ISerializable<ISerializedAuthor> {
  public constructor(protected readonly data: IAuthor) {
    super(AUTHOR_MODEL, data);
  }

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
    return super._retrieve({
      kind: AUTHOR_MODEL,
      filter: { id },
      expand,
    });
  }

  public async delete(): Promise<void> {
    return super._delete({ id : this.id });
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

    return super.deserialize(AUTHOR_MODEL, result.rows[0], expand);
  }

  public static async forPublisher(
    publisher: Publisher,
    expand?: string[]
  ): Promise<Author[]> {
    return super._for(
      AUTHOR_MODEL,
      { key: "publisher", value: publisher.id },
      expand
    );
  }

  public static async forUser(
    user: User,
    expand?: string[]
  ): Promise<Author[]> {
    return super._for(AUTHOR_MODEL, { key: "user", value: user.id }, expand);
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
}
