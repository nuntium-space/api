import { INotExpandedResource } from "../common/INotExpandedResource";
import { Model } from "../config/Model";
import { IAuthor, AUTHOR_MODEL } from "../types/author";
import { Publisher } from "./Publisher";
import { User } from "./User";

export class Author extends Model {
  public constructor(protected readonly record: IAuthor) {
    super(AUTHOR_MODEL, record);
  }

  ////////////////
  // PROPERTIES //
  ////////////////

  public get id(): string {
    return this.record.id;
  }

  public get user(): User | INotExpandedResource {
    return this.record.user;
  }

  public get publisher(): Publisher | INotExpandedResource {
    return this.record.publisher;
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
    return super._delete({ id: this.id });
  }

  ///////////////
  // UTILITIES //
  ///////////////

  public static async retrieveWithUserAndPublisher(
    user: User | string,
    publisher: Publisher | string,
    expand?: string[]
  ): Promise<Author> {
    return super._retrieve({
      kind: AUTHOR_MODEL,
      filter: {
        user: user instanceof User ? user.id : user,
        publisher: publisher instanceof Publisher ? publisher.id : publisher,
      },
      expand,
    });
  }

  public static async forPublisher(
    publisher: Publisher,
    expand?: string[]
  ): Promise<Author[]> {
    return super._for({
      kind: AUTHOR_MODEL,
      filter: { key: "publisher", value: publisher.id },
      expand,
    });
  }

  public static async forUser(
    user: User,
    expand?: string[]
  ): Promise<Author[]> {
    return super._for({
      kind: AUTHOR_MODEL,
      filter: { key: "user", value: user.id },
      expand,
    });
  }
}
