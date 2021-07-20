import Boom from "@hapi/boom";
import { isEqual } from "lodash";
import { PoolClient } from "pg";
import { DatabaseRecord } from "../common/DatabaseRecord";
import { ExpandQuery } from "../common/ExpandQuery";
import { Account } from "../models/Account";
import Database from "../utilities/Database";

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

export class Model {
  constructor(
    protected readonly kind: ModelKind,
    protected readonly data: DatabaseRecord
  ) {}

  public instance<T>(): T {
    return this.kind.getInstance(this.data) as unknown as T;
  }

  //////////
  // CRUD //
  //////////

  public static async _create(kind: ModelKind, data: { [key: string]: any }, client?: PoolClient): Promise<void> {
    await (client ?? Database.pool)
      .query(
        `
        inser into "${kind.table}"
          (${Object.keys(data).map(_ => `"${_}"`).join(", ")})
        values
          (${Object.keys(data).map((_, index) => `$${index + 1}`).join(", ")})
        `,
        Object.values(data)
      )
      .catch(() => {
        throw Boom.badRequest();
      });
  }

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
    } = await Database.pool
      .query(
        `
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

  public async _delete(filter: { [key: string]: any }, client?: PoolClient): Promise<void> {
    if (!this.kind.keys.some((_) => isEqual(_, Object.keys(filter)))) {
      throw Boom.badImplementation(
        `"${Object.keys(filter).join(", ")}" is not a key of "${this.kind.table}"`
      );
    }

    await (client ?? Database.pool)
      .query(
        `
        delete
        from "${this.kind.table}"
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

    const { rowCount } = await Database.pool
      .query(
        `
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

    const { rows } = await Database.pool
      .query(
        `
        select *
        from "${kind.table}"
        where "${filter.key}" = $1
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
