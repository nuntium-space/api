import Boom from "@hapi/boom";
import { isEqual } from "lodash";
import { createPool, sql } from "slonik";
import { Account } from "../models/Account";

export type DatabaseRecord = { [ key: string ]: any };
export type ExpandQuery = string[];

export interface ModelKind
{
  table: string,
  keys: string[][],
  getInstance(data: any): Model,
};

export const MODELS: { [ key: string ]: ModelKind } /*IdPrefixes<ModelKind>*/ = {
  ACCOUNT: {
    table: "accounts",
    keys: [
      ["id"],
      ["user", "type"],
      ["type", "external_id"],
    ],
    getInstance: data => new Account(data),
  },
  /*
  ARTICLE: {
    table: "articles",
    keys: [ "id" ],
  },
  ARTICLE_DRAFT: {
    table: "article_drafts",
    keys: [ "id" ],
  },
  ARTICLE_REPORT: {
    table: "article_reports",
    keys: [ "id" ],
  },
  AUTHOR: {
    table: "authors",
    keys: [ "id" ],
  },
  AUTHOR_INVITE: {
    table: "author_invites",
    keys: [ "id" ],
  },
  BUNDLE: {
    table: "bundles",
    keys: [ "id" ],
  },
  DRAFT_SOURCE: {
    table: "draft_sources",
    keys: [ "id" ],
  },
  ORGANIZATION: {
    table: "organizations",
    keys: [ "id" ],
  },
  PAYMENT_METHOD: {
    table: "payment_methods",
    keys: [ "id" ],
  },
  PRICE: {
    table: "prices",
    keys: [ "id" ],
  },
  PUBLISHER: {
    table: "publishers",
    keys: [ "id" ],
  },
  SESSION: {
    table: "sessions",
    keys: [ "id" ],
  },
  SIGN_IN_REQUEST: {
    table: "sign_in_requests",
    keys: [ "id" ],
  },
  SOURCE: {
    table: "sources",
    keys: [ "id" ],
  },
  SUBSCRIPTION: {
    table: "subscriptions",
    keys: [ "id" ],
  },
  USER: {
    table: "users",
    keys: [ "id" ],
  },
  */
};

const pool = createPool(process.env.DATABASE_URL as string);

export class Model
{
  constructor(
    protected readonly KIND: ModelKind,
    protected readonly data: DatabaseRecord,
  )
  {}

  public instance<T>(): T
  {
    return this.KIND.getInstance(this.data) as unknown as T;
  }

  public static async retrieve(kind: ModelKind, filter: { [ key: string ]: any }, expand?: ExpandQuery): Promise<Model>
  {
    if (!kind.keys.some(_ => isEqual(_ , Object.keys(filter)))) {
      throw Boom.badImplementation(`"${Object.keys(filter).join(", ")}" is not a key of "${kind.table}"`);
    }

    const result = await pool
      .query(
        sql`
        select *
        from "${kind.table}"
        where
          ${
            Object
              .keys(filter)
              .map((key, index) =>
              {
                return `"${key}" = $${index + 1}`;
              })
              .join(" and ")
          }
        `,
        Object.values(filter),
      )
      .catch(() =>
      {
        throw Boom.badImplementation();
      });

    if (result.rowCount === 0) {
      throw Boom.notFound();
    }

    return Model.deserialize(kind, result.rows[0], expand);
  }

  protected static deserialize<T>(kind: ModelKind, data: DatabaseRecord, expand?: ExpandQuery): T
  {
    return new Model(kind, data).instance<T>();
  }
}
