import Boom from "@hapi/boom";
import { INotExpandedResource } from "../common/INotExpandedResource";
import { ISerializable } from "../common/ISerializable";
import { Model } from "../config/Model";
import { ILike, ISerializedLike, LIKE_MODEL } from "../types/like";
import Database from "../utilities/Database";
import { Article } from "./Article";
import { User } from "./User";

export class Like
  extends Model
  implements ISerializable<Promise<ISerializedLike>>
{
  public constructor(protected readonly record: ILike) {
    super(LIKE_MODEL, data);
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

  //////////
  // CRUD //
  //////////

  public static async create(
    user: User | string,
    article: Article | string
  ): Promise<void> {
    const client = await Database.pool.connect();
    await client.query("begin");

    await super._create(
      LIKE_MODEL,
      {
        user: user instanceof User ? user.id : user,
        article: article instanceof Article ? article.id : article,
      },
      client
    );

    await client
      .query(
        `
        update "article_stats"
        set "like_count" = "like_count" + 1
        where "id" = $1
        `,
        [article instanceof Article ? article.id : article]
      )
      .catch(async () => {
        await client.query("rollback");

        throw Boom.badImplementation();
      });

    await client.query("commit");
    client.release();
  }

  public static async retrieveWithUserAndArticle(
    user: User | string,
    article: Article | string,
    expand?: string[]
  ): Promise<Like> {
    return super._retrieve({
      kind: LIKE_MODEL,
      filter: {
        user: user instanceof User ? user.id : user,
        article: article instanceof Article ? article.id : article,
      },
      expand,
    });
  }

  public async delete(): Promise<void> {
    const client = await Database.pool.connect();
    await client.query("begin");

    await super._delete(
      {
        filter: {
          user: this.user.id,
          article: this.article.id,
        },
      },
      client
    );

    await client
      .query(
        `
        update "article_stats"
        set "like_count" = "like_count" - 1
        where "id" = $1
        `,
        [this.article.id]
      )
      .catch(async () => {
        await client.query("rollback");

        throw Boom.badImplementation();
      });

    await client.query("commit");
    client.release();
  }

  ///////////////
  // UTILITIES //
  ///////////////

  public static async existsWithUserAndArticle(
    user: User | string,
    article: Article | string
  ): Promise<boolean> {
    return super._exists({
      kind: LIKE_MODEL,
      filter: {
        user: user instanceof User ? user.id : user,
        article: article instanceof Article ? article.id : article,
      },
    });
  }

  public static async forUser(
    user: User | string,
    expand?: string[]
  ): Promise<Like[]> {
    return super._for({
      kind: LIKE_MODEL,
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

  public async serialize(): Promise<ISerializedLike> {
    return {
      article:
        this.article instanceof Article
          ? await this.article.serialize()
          : this.article,
    };
  }
}
