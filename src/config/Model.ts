import Boom from "@hapi/boom";
import { isEqual } from "lodash";
import { PoolClient } from "pg";
import { DatabaseRecord } from "../common/DatabaseRecord";
import { ExpandQuery } from "../common/ExpandQuery";
import { SelectQuery } from "../common/SelectQuery";
import Database from "../utilities/Database";
import Utilities from "../utilities/Utilities";

export interface ModelKind {
  table: string;
  /**
   * Primary or Unique Keys
   */
  keys: string[][];
  /**
   * Foreign Keys
   */
  expand: {
    field: string;
    model: ModelKind;
  }[];
  fields: string[];
  getModel(): any;
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

  public static async _retrieve<T>({
    kind,
    filter,
    expand,
    select,
  }: {
    kind: ModelKind;
    filter: { [key: string]: any };
    expand?: ExpandQuery;
    select?: SelectQuery;
  }): Promise<T> {
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

  public static async _exists({ kind, filter }: {
    kind: ModelKind,
    filter: { [key: string]: any }
  }): Promise<boolean> {
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

  public static async _for<T>({ kind, filter, expand, select, order }: {
    kind: ModelKind;
    filter: { key: string, value: any };
    expand?: ExpandQuery;
    select?: SelectQuery;
    order?: { field: string, direction?: "asc" | "desc" },
  }): Promise<T[]> {
    select ??= kind.fields;

    if (select.some((_) => !kind.fields.includes(_)) || (order && !kind.fields.includes(order.field))) {
      throw Boom.badImplementation(
        `"${select.find((_) => !kind.fields.includes(_))}" is not a field of "${
          kind.table
        }"`
      );
    }

    if (order)
    {
      order.direction ??= "asc";
    }

    const { rows } = await Database.pool
      .query(
        `
        select *
        from "${kind.table}"
        where "${filter.key}" = $1
        ${order !== undefined ? `order by ${order.field} ${order.direction}` : ""}
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

  protected static async deserialize<T>(
    kind: ModelKind,
    data: DatabaseRecord,
    expand?: ExpandQuery
  ): Promise<T> {
    expand ??= [];

    if (!expand.every((_) => kind.expand.some((__) => __.field === _))) {
      throw Boom.badImplementation(
        `"${expand.find(
          (_) => !kind.expand.find((__) => __.field === _)
        )}" is not a foreign key of "${kind.table}"`
      );
    }

    if (!expand.every((_) => Object.keys(data).includes(_))) {
      throw Boom.badImplementation(
        `"${expand.find(
          (_) => !Object.keys(data).includes(_)
        )}" must be included in order to be expanded`
      );
    }

    const expandedData = await Promise.all(
      Object.entries(data).map(async ([key, value]) => {
        let newValue: any;

        // Cannot be expanded
        if (!kind.expand.find((_) => _.field === key)) {
          newValue = value;
        } else if (!expand?.includes(key)) {
          newValue = { id: value };
        } else {
          newValue = await kind.expand
            .find((_) => _.field === key)!
            .model.getModel()
            .retrieve(value, Utilities.getNestedExpandQuery(expand, key));
        }

        return { [key]: newValue };
      })
    );

    return new Model(
      kind,
      expandedData.reduce((prev, curr) => ({ ...prev, ...curr }), {}) // Reduce the array of objects to a single object
    ).instance<T>();
  }
}
