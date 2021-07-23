import Boom from "@hapi/boom";
import { ExpandQuery } from "../common/ExpandQuery";
import { INotExpandedResource } from "../common/INotExpandedResource";
import { ISerializable } from "../common/ISerializable";
import { SelectQuery } from "../common/SelectQuery";
import { Config } from "../config/Config";
import { Model } from "../config/Model";
import { ISerializedArticle, IArticle, ARTICLE_MODEL } from "../types/article";
import Database from "../utilities/Database";
import { Author } from "./Author";
import { Bookmark } from "./Bookmark";
import { Like } from "./Like";
import { Publisher } from "./Publisher";
import { User } from "./User";

export class Article
  extends Model
  implements ISerializable<Promise<ISerializedArticle>>
{
  public constructor(protected readonly record: IArticle) {
    super(ARTICLE_MODEL, data);
  }

  ////////////////
  // PROPERTIES //
  ////////////////

  public get id(): string {
    return this.record.id;
  }

  public get title(): string {
    return this.record.title;
  }

  public get content(): string {
    return this.record.content;
  }

  public get author(): Author | INotExpandedResource {
    return this.record.author;
  }

  public get reading_time(): number {
    return this.record.reading_time;
  }

  public get created_at(): Date {
    return this.record.created_at;
  }

  public get updated_at(): Date {
    return this.record.updated_at;
  }

  //////////
  // CRUD //
  //////////

  public static async retrieve(
    id: string,
    expand?: ExpandQuery,
    select?: SelectQuery
  ): Promise<Article> {
    return super._retrieve<Article>({
      kind: ARTICLE_MODEL,
      filter: { id },
      expand,
      select: select ?? [
        "id",
        "title",
        "author",
        "reading_time",
        "created_at",
        "updated_at",
      ],
    });
  }

  public static async retrieveMultiple(
    ids: string[],
    expand?: string[]
  ): Promise<Article[]> {
    const result = await Database.pool.query(
      `
      select
        "id",
        "title",
        "author",
        "reading_time",
        "created_at",
        "updated_at"
      from "articles"
      where "id" = any ($1)
      order by "created_at" desc
      `,
      [ids]
    );

    return Promise.all(
      result.rows.map((row) =>
        Article.deserialize<Article>(ARTICLE_MODEL, row, expand)
      )
    );
  }

  public static async trending(expand?: string[]): Promise<Article[]> {
    const result = await Database.pool.query(
      `
      select
        "a"."id",
        "a"."title",
        "a"."author",
        "a"."reading_time",
        "a"."created_at",
        "a"."updated_at"
      from
        "article_stats" as "s"
        inner join
        "articles" as "a"
        using ("id")
      order by ("s"."score" / (extract(day from current_timestamp - "created_at") * 0.5 + 1)) desc
      limit $1
      `,
      [Config.TRENDING_ARTICLES_MAX_LENGTH]
    );

    return Promise.all(
      result.rows.map((row) =>
        Article.deserialize<Article>(ARTICLE_MODEL, row, expand)
      )
    );
  }

  public async delete(): Promise<void> {
    const client = await Database.pool.connect();
    await client.query("begin");

    await super._delete({ id: this.id }, client);

    await Config.ELASTICSEARCH.delete({
      index: "articles",
      id: this.id,
    }).catch(async () => {
      await client.query("rollback");

      throw Boom.badImplementation();
    });

    await client.query("commit");
    client.release();
  }

  ///////////////
  // UTILITIES //
  ///////////////

  public async retrieveContent(): Promise<string> {
    const { content } = await Article.retrieve(this.id, undefined, ["content"]);

    return content;
  }

  public static async forFeed(
    user: User,
    options: {
      limit: number;
      offset: number;
      expand?: string[];
    }
  ): Promise<Article[]> {
    const result = await Database.pool.query(
      `
      select
        distinct on ("art"."created_at", "art"."id")
        "art"."id",
        "art"."title",
        "art"."author",
        "art"."reading_time",
        "art"."created_at",
        "art"."updated_at"
      from
        "v_active_subscriptions" as "s"
        inner join
        "prices" as "p"
        on "s"."price" = "p"."id"
        inner join
        "bundles_publishers" as "bp"
        on "p"."bundle" = "bp"."bundle"
        inner join
        "authors" as "aut"
        on "aut"."publisher" = "bp"."publisher"
        inner join
        "articles" as "art"
        on "art"."author" = "aut"."id"
      where
        "s"."user" = $1
      order by "art"."created_at", "art"."id" desc
      limit $2
      offset $3
      `,
      [user.id, options.limit, options.offset]
    );

    return Promise.all(
      result.rows.map((row) =>
        Article.deserialize<Article>(ARTICLE_MODEL, row, options.expand)
      )
    );
  }

  public static async forAuthor(
    author: Author | INotExpandedResource | string,
    expand?: string[]
  ): Promise<Article[]> {
    return super._for({
      kind: ARTICLE_MODEL,
      filter: {
        key: "author",
        value: typeof author === "string" ? author : author.id,
      },
      expand,
      select: [
        "id",
        "title",
        "author",
        "reading_time",
        "created_at",
        "updated_at",
      ],
      order: { field: "created_at", direction: "desc" },
    });
  }

  public static async forPublisher(
    publisher: Publisher,
    expand?: string[]
  ): Promise<Article[]> {
    const result = await Database.pool.query(
      `
      select
        "art"."id",
        "art"."title",
        "art"."author",
        "art"."reading_time",
        "art"."created_at",
        "art"."updated_at"
      from
        articles as art
        inner join
        authors as aut
        on
          art.author = aut.id
          and
          aut.publisher = $1
      order by "created_at" desc
      `,
      [publisher.id]
    );

    return Promise.all(
      result.rows.map((row) =>
        Article.deserialize<Article>(ARTICLE_MODEL, row, expand)
      )
    );
  }

  ///////////////////
  // SERIALIZATION //
  ///////////////////

  public async serialize(options?: {
    for?: User | INotExpandedResource;
    /**
     * @default false
     */
    includeMetadata?: boolean;
  }): Promise<ISerializedArticle> {
    options ??= {};
    options.includeMetadata ??= false;

    if (options.includeMetadata && !options.for) {
      throw Boom.badImplementation();
    }

    const obj: ISerializedArticle = {
      id: this.id,
      title: this.title,
      author:
        this.author instanceof Author
          ? this.author.serialize({ for: options.for })
          : this.author,
      reading_time: this.reading_time,
      created_at: this.created_at.toISOString(),
      updated_at: this.updated_at.toISOString(),
    };

    if (options.includeMetadata) {
      obj.__metadata = {
        is_liked: await Like.existsWithUserAndArticle(
          options.for instanceof User ? options.for : options.for!.id,
          this
        ),
        is_bookmarked: await Bookmark.existsWithUserAndArticle(
          options.for instanceof User ? options.for : options.for!.id,
          this
        ),
      };
    }

    return obj;
  }
}
