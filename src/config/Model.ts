import Boom from "@hapi/boom";
import { isEqual } from "lodash";
import { PoolClient } from "pg";
import { DatabaseRecord } from "../common/DatabaseRecord";
import { ExpandQuery } from "../common/ExpandQuery";
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
  fields: string[];
  getInstance(data: any): Model;
}

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

  public static async _create(
    kind: ModelKind,
    data: { [key: string]: any },
    client?: PoolClient
  ): Promise<void> {
    await (client ?? Database.pool)
      .query(
        `
        inser into "${kind.table}"
          (${Object.keys(data)
            .map((_) => `"${_}"`)
            .join(", ")})
        values
          (${Object.keys(data)
            .map((_, index) => `$${index + 1}`)
            .join(", ")})
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
    expand?: ExpandQuery,
    select?: string[]
  ): Promise<T> {
    if (!kind.keys.some((_) => isEqual(_, Object.keys(filter)))) {
      throw Boom.badImplementation(
        `"${Object.keys(filter).join(", ")}" is not a key of "${kind.table}"`
      );
    }

    select ??= kind.fields;

    if (select.some((_) => !kind.fields.includes(_))) {
      throw Boom.badImplementation(
        `"${select.find((_) => !kind.fields.includes(_))}" is not a field of "${
          kind.table
        }"`
      );
    }

    const {
      rows: [first],
    } = await Database.pool
      .query(
        `
        select ${select.map((_) => `"${_}"`).join(", ")}
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

  public async _delete(
    filter: { [key: string]: any },
    client?: PoolClient
  ): Promise<void> {
    if (!this.kind.keys.some((_) => isEqual(_, Object.keys(filter)))) {
      throw Boom.badImplementation(
        `"${Object.keys(filter).join(", ")}" is not a key of "${
          this.kind.table
        }"`
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
