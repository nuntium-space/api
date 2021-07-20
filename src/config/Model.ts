import Boom from "@hapi/boom";
import { createPool, sql } from "slonik";
import { Account } from "../models/Account";
import { IdPrefixes } from "./Config";

export type DatabaseRecord = { [ key: string ]: any };

export interface ModelKind
{
  table: string,
  keys: string[],
  getInstance(data: DatabaseRecord): Model,
};

export const MODELS: IdPrefixes<ModelKind> = {
  ACCOUNT: {
    table: "accounts",
    keys: [ "id" ],
    getInstance: (data) => new Account(TODO), make constructor public
  },
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
};

const pool = createPool(process.env.DATABASE_URL as string);

export class Model
{
  constructor(
    protected readonly KIND: ModelKind,
    public data: { [ key: string ]: any },
  )
  {}

  public static async retrieve(kind: ModelKind, filter: { [ key: string ]: any }): Promise<Model>
  {
    if (!Object.keys(filter).every(_ => kind.keys.includes(_))) {
      throw Boom.badImplementation(`${
        Object.keys(filter).find(_ => !kind.keys.includes(_))
      } is not a key of ${kind.table}`);
    }

    const result = await pool
      .query(
        sql`
        select *
        from "${kind.table}"
        where
          ${
            Object
              .entries(filter)
              .map(([ key, value ], index) =>
              {
                return `"${key}" = $${index + 1}`;
              })
              .join(" and ")
          }
        `,
        ["id"]
      )
      .catch(() =>
      {
        throw Boom.badImplementation();
      });

    if (result.rowCount === 0) {
      throw Boom.notFound();
    }

    return Model.deserialize(kind, result.rows[0]);
  }

  private static deserialize(kind: ModelKind, data: any): Model
  {
    return new Model(kind, data);
  }
}
