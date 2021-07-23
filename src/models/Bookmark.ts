import { INotExpandedResource } from "../common/INotExpandedResource";
import { Model } from "../config/Model";
import { IBookmark, BOOKMARK_MODEL } from "../types/bookmark";
import { Article } from "./Article";
import { User } from "./User";

export class Bookmark extends Model {
  public constructor(protected readonly record: IBookmark) {
    super(BOOKMARK_MODEL, record);
  }

  ////////////////
  // PROPERTIES //
  ////////////////

  public get user(): User | INotExpandedResource {
    return this.record.user;
  }

  public get article(): Article | INotExpandedResource {
    return this.record.article;
  }

  public get created_at(): Date {
    return this.record.created_at;
  }

  //////////
  // CRUD //
  //////////

  public static async create(
    user: User | string,
    article: Article | string
  ): Promise<void> {
    return super._create(BOOKMARK_MODEL, {
      user: user instanceof User ? user.id : user,
      article: article instanceof Article ? article.id : article,
    });
  }

  public static async retrieveWithUserAndArticle(
    user: User | string,
    article: Article | string,
    expand?: string[]
  ): Promise<Bookmark> {
    return super._retrieve({
      kind: BOOKMARK_MODEL,
      filter: {
        user: user instanceof User ? user.id : user,
        article: article instanceof Article ? article.id : article,
      },
      expand,
    });
  }

  public async delete(): Promise<void> {
    return super._delete({
      filter: {
        user: this.user.id,
        article: this.article.id,
      },
    });
  }

  ///////////////
  // UTILITIES //
  ///////////////

  public static async existsWithUserAndArticle(
    user: User | string,
    article: Article | string
  ): Promise<boolean> {
    return super._exists({
      kind: BOOKMARK_MODEL,
      filter: {
        user: user instanceof User ? user.id : user,
        article: article instanceof Article ? article.id : article,
      },
    });
  }

  public static async forUser(
    user: User | string,
    expand?: string[]
  ): Promise<Bookmark[]> {
    return super._for({
      kind: BOOKMARK_MODEL,
      filter: {
        key: "user",
        value: user instanceof User ? user.id : user,
      },
      expand,
    });
  }
}
