import { INotExpandedResource } from "../common/INotExpandedResource";
import { ISerializable } from "../common/ISerializable";
import { Model } from "../config/Model";
import { ISerializedBookmark, IBookmark, BOOKMARK_MODEL } from "../types/bookmark";
import { Article } from "./Article";
import { User } from "./User";

export class Bookmark extends Model implements ISerializable<Promise<ISerializedBookmark>> {
  public constructor(protected readonly data: IBookmark) {
    super(BOOKMARK_MODEL, data);
  }

  ////////////////
  // PROPERTIES //
  ////////////////

  public get user(): User | INotExpandedResource {
    return this.data.user;
  }

  public get article(): Article | INotExpandedResource {
    return this.data.article;
  }

  public get created_at(): Date {
    return this.data.created_at;
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

  ///////////////////
  // SERIALIZATION //
  ///////////////////

  public async serialize(): Promise<ISerializedBookmark> {
    return {
      article:
        this.article instanceof Article
          ? await this.article.serialize()
          : this.article,
      created_at: this.created_at.toISOString(),
    };
  }
}
