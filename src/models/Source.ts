import Boom from "@hapi/boom";
import { PoolClient } from "pg";
import { INotExpandedResource } from "../common/INotExpandedResource";
import { ISerializable } from "../common/ISerializable";
import { Config } from "../config/Config";
import {
  ICreateSource,
  IDatabaseSource,
  ISerializedSource,
} from "../types/source";
import Database from "../utilities/Database";
import Utilities from "../utilities/Utilities";
import { Article } from "./Article";

export class Source implements ISerializable<ISerializedSource> {
  private constructor(
    public readonly id: string,
    public readonly url: string,
    public readonly article: Article | INotExpandedResource
  ) {}

  //////////
  // CRUD //
  //////////

  public static async createMultiple(
    data: ICreateSource[],
    article: Article | INotExpandedResource | string,
    client: PoolClient
  ): Promise<void> {
    await Promise.all(
      data.map((_) => {
        return client.query(
          `
                        insert into "sources"
                            ("id", "url", "article")
                        values
                            ($1, $2, $3)
                        returning *
                        `,
          [
            Utilities.id(Config.ID_PREFIXES.SOURCE),
            _.url,
            typeof article === "string" ? article : article.id,
          ]
        );
      })
    ).catch(async () => {
      await client.query("rollback");

      throw Boom.badImplementation();
    });
  }

  public static async deleteAll(
    article: Article | INotExpandedResource | string
  ): Promise<void> {
    await Database.pool.query(
      `
                delete from "sources"
                where "article" = $1
                `,
      [typeof article === "string" ? article : article.id]
    );
  }

  ///////////////
  // UTILITIES //
  ///////////////

  public static async forArticle(article: Article | string): Promise<Source[]> {
    const result = await Database.pool.query(
      `
                select *
                from "sources"
                where "article" = $1
                `,
      [article instanceof Article ? article.id : article]
    );

    return Promise.all(result.rows.map((_) => Source.deserialize(_)));
  }

  ///////////////////
  // SERIALIZATION //
  ///////////////////

  public serialize(): ISerializedSource {
    return {
      url: this.url,
    };
  }

  private static async deserialize(
    data: IDatabaseSource,
    expand?: string[]
  ): Promise<Source> {
    const article = expand?.includes("article")
      ? await Article.retrieve(data.article)
      : { id: data.article };

    return new Source(data.id, data.url, article);
  }
}
