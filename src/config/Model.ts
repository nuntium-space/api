import Boom from "@hapi/boom";
import { isEqual } from "lodash";
import { createPool, sql } from "slonik";
import { Account } from "../models/Account";

export type DatabaseRecord = { [key: string]: any };
export type ExpandQuery = string[];

export interface ModelKind {
  table: string;
  /**
   * Primary or Unique Keys
   */
  keys: string[][];
  /**
   * Foreign Keys
   */
  expand: string[];
  getInstance(data: any): Model;
}

export const MODELS: { [key: string]: ModelKind } /*IdPrefixes<ModelKind>*/ = {
  ACCOUNT: {
    table: "accounts",
    keys: [["id"], ["user", "type"], ["type", "external_id"]],
    expand: ["user"],
    getInstance: (data) => new Account(data),
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

export class Model {
  constructor(
    protected readonly KIND: ModelKind,
    protected readonly data: DatabaseRecord
  ) {}

  public instance<T>(): T {
    return this.KIND.getInstance(this.data) as unknown as T;
  }

  //////////
  // CRUD //
  //////////

  public static async _retrieve<T>(
    kind: ModelKind,
    filter: { [key: string]: any },
    expand?: ExpandQuery
  ): Promise<T> {
    if (!kind.keys.some((_) => isEqual(_, Object.keys(filter)))) {
      throw Boom.badImplementation(
        `"${Object.keys(filter).join(", ")}" is not a key of "${kind.table}"`
      );
    }

    const {
      rows: [first],
    } = await pool
      .query(
        sql`
        select *
        from "${kind.table}"
        where
          ${Object.keys(filter)
            .map((key, index) => {
              return `"${key}" = $${index + 1}`;
            })
            .join(" and ")}
        `,
        Object.values(filter)
      )
      .catch(() => {
        throw Boom.badImplementation();
      });

    if (!first) {
      throw Boom.notFound();
    }

    return Model.deserialize<T>(kind, first, expand);
  }

  ///////////////
  // UTILITIES //
  ///////////////

  public static async _exists(
    kind: ModelKind,
    filter: { [key: string]: any }
  ): Promise<boolean> {
    if (!kind.keys.some((_) => isEqual(_, Object.keys(filter)))) {
      throw Boom.badImplementation(
        `"${Object.keys(filter).join(", ")}" is not a key of "${kind.table}"`
      );
    }

    const { rowCount } = await pool
      .query(
        sql`
        select 1
        from "${kind.table}"
        where
          ${Object.keys(filter)
            .map((key, index) => {
              return `"${key}" = $${index + 1}`;
            })
            .join(" and ")}
          limit 1
        `,
        Object.values(filter)
      )
      .catch(() => {
        throw Boom.badImplementation();
      });

    return rowCount > 0;
  }

  public static async _for<T>(
    kind: ModelKind,
    filter: { key: string; value: string },
    expand?: ExpandQuery
  ): Promise<T[]> {
    if (!kind.expand.includes(filter.key)) {
      throw Boom.badImplementation(
        `"${filter.key}" is not a foreign key of "${kind.table}"`
      );
    }

    const { rows } = await pool
      .query(
        sql`
        select *
        from "${kind.table}"
        where ${filter.key} = $1
        `,
        [filter.value]
      )
      .catch(() => {
        throw Boom.badImplementation();
      });

    return Promise.all(rows.map((_) => Model.deserialize<T>(kind, _, expand)));
  }

  ///////////////////
  // SERIALIZATION //
  ///////////////////

  private static deserialize<T>(
    kind: ModelKind,
    data: DatabaseRecord,
    expand?: ExpandQuery
  ): T {
    return new Model(kind, data).instance<T>();
  }
}
