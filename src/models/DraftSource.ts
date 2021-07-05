import Boom from "@hapi/boom";
import { PoolClient } from "pg";
import { INotExpandedResource } from "../common/INotExpandedResource";
import { ISerializable } from "../common/ISerializable";
import { Config } from "../config/Config";
import {
  ICreateDraftSource,
  IDatabaseDraftSource,
  ISerializedDraftSource,
} from "../types/draft-source";
import Database from "../utilities/Database";
import Utilities from "../utilities/Utilities";
import { ArticleDraft } from "./ArticleDraft";

export class DraftSource implements ISerializable<ISerializedDraftSource> {
  private constructor(
    public readonly id: string,
    public readonly url: string,
    public readonly draft: ArticleDraft | INotExpandedResource
  ) {}

  //////////
  // CRUD //
  //////////

  public static async createMultiple(
    data: ICreateDraftSource[],
    draft: ArticleDraft | INotExpandedResource | string,
    client: PoolClient
  ): Promise<void> {
    await Promise.all(
      data.map((_) => {
        return client.query(
          `
          insert into "draft_sources"
            ("id", "url", "draft")
          values
            ($1, $2, $3)
          returning *
          `,
          [
            Utilities.id(Config.ID_PREFIXES.DRAFT_SOURCE),
            _.url,
            typeof draft === "string" ? draft : draft.id,
          ]
        );
      })
    ).catch(async () => {
      await client.query("rollback");

      throw Boom.badImplementation();
    });
  }

  public static async deleteAll(
    draft: ArticleDraft | INotExpandedResource | string
  ): Promise<void> {
    await Database.pool.query(
      `
      delete from "draft_sources"
      where "draft" = $1
      `,
      [typeof draft === "string" ? draft : draft.id]
    );
  }

  ///////////////
  // UTILITIES //
  ///////////////

  public static async forDraft(
    draft: ArticleDraft | string
  ): Promise<DraftSource[]> {
    const result = await Database.pool.query(
      `
      select *
      from "draft_sources"
      where "draft" = $1
      `,
      [draft instanceof ArticleDraft ? draft.id : draft]
    );

    return Promise.all(result.rows.map((_) => DraftSource.deserialize(_)));
  }

  ///////////////////
  // SERIALIZATION //
  ///////////////////

  public serialize(): ISerializedDraftSource {
    return {
      url: this.url,
    };
  }

  private static async deserialize(
    data: IDatabaseDraftSource,
    expand?: string[]
  ): Promise<DraftSource> {
    const draft = expand?.includes("draft")
      ? await ArticleDraft.retrieve(data.draft)
      : { id: data.draft };

    return new DraftSource(data.id, data.url, draft);
  }
}
