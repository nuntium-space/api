import Boom from "@hapi/boom";
import { INotExpandedResource } from "../common/INotExpandedResource";
import { ISerializable } from "../common/ISerializable";
import { Config } from "../config/Config";
import {
  ISerializedArticleReport,
  ICreateArticleReport,
  IDatabaseArticleReport,
} from "../types/article-report";
import Database from "../utilities/Database";
import Utilities from "../utilities/Utilities";
import { Article } from "./Article";
import { User } from "./User";

export class ArticleReport
  implements ISerializable<Promise<ISerializedArticleReport>>
{
  private constructor(
    public readonly id: string,
    public readonly user: User | INotExpandedResource,
    public readonly article: Article | INotExpandedResource,
    public readonly reason: string,
    public readonly created_at: Date
  ) {}

  //////////
  // CRUD //
  //////////

  public static async create(
    data: ICreateArticleReport
  ): Promise<INotExpandedResource> {
    const id = Utilities.id(Config.ID_PREFIXES.ARTICLE_REPORT);

    await Database.pool
      .query(
        `
        insert into "article_reports"
          ("id", "user", "article", "reason")
        values
          ($1, $2, $3, $4)
        `,
        [id, data.user, data.article, data.reason]
      )
      .catch(() => {
        throw Boom.badRequest();
      });

    return { id };
  }

  public static async retrieve(
    id: string,
    expand?: string[]
  ): Promise<ArticleReport> {
    const result = await Database.pool.query(
      `
      select *
      from "article_reports"
      where "id" = $1
      `,
      [id]
    );

    if (result.rowCount === 0) {
      throw Boom.notFound();
    }

    return ArticleReport.deserialize(result.rows[0], expand);
  }

  ///////////////
  // UTILITIES //
  ///////////////

  public static async list(expand?: string[]): Promise<ArticleReport[]> {
    const result = await Database.pool.query(`
        select *
        from "article_reports"
        order by "created_at" desc
      `);

    return Promise.all(
      result.rows.map((_) => ArticleReport.deserialize(_, expand))
    );
  }

  ///////////////////
  // SERIALIZATION //
  ///////////////////

  public async serialize(options?: {
    for?: User | INotExpandedResource;
  }): Promise<ISerializedArticleReport> {
    options ??= {};

    return {
      id: this.id,
      user:
        this.user instanceof User
          ? this.user.serialize({ for: options.for })
          : this.user,
      article:
        this.article instanceof Article
          ? await this.article.serialize({ for: options.for })
          : this.article,
      reason: this.reason,
      created_at: this.created_at.toISOString(),
    };
  }

  private static async deserialize(
    data: IDatabaseArticleReport,
    expand?: string[]
  ): Promise<ArticleReport> {
    const user = expand?.includes("user")
      ? await User.retrieve(data.user)
      : { id: data.user };

    const article = expand?.includes("article")
      ? await Article.retrieve(
          data.article,
          Utilities.getNestedExpandQuery(expand, "article")
        )
      : { id: data.article };

    return new ArticleReport(
      data.id,
      user,
      article,
      data.reason,
      data.created_at
    );
  }
}
