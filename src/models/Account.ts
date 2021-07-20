import Boom from "@hapi/boom";
import { INotExpandedResource } from "../common/INotExpandedResource";
import { Config } from "../config/Config";
import { Model, MODELS } from "../config/Model";
import { IAccount, ICreateAccount } from "../types/account";
import Database from "../utilities/Database";
import Utilities from "../utilities/Utilities";
import { User } from "./User";

export class Account extends Model {
  public constructor(protected readonly data: IAccount) {
    super(MODELS.ACCOUNT, data);
  }

  ////////////////
  // PROPERTIES //
  ////////////////

  public get id(): string
  {
    return this.data.id;
  }

  public get user(): User | INotExpandedResource
  {
    return this.data.user;
  }

  public get type(): string
  {
    return this.data.type;
  }

  public get external_id(): string
  {
    return this.data.external_id;
  }

  //////////
  // CRUD //
  //////////

  public static async create(
    data: ICreateAccount
  ): Promise<INotExpandedResource> {
    const id = Utilities.id(Config.ID_PREFIXES.ACCOUNT);

    await Database.pool
      .query(
        `
        insert into "accounts"
          ("id", "user", "type", "external_id")
        values
          ($1, $2, $3, $4)
        `,
        [
          id,
          typeof data.user === "string" ? data.user : data.user.id,
          data.type,
          data.external_id,
        ]
      )
      .catch(() => {
        throw Boom.badRequest();
      });

    return { id };
  }

  public static async retrieveWithUserAndType(
    user: User | INotExpandedResource | string,
    type: string
  ): Promise<Account> {
    const model = await super.retrieve(MODELS.ACCOUNT, {
      user: typeof user === "string" ? user : user.id,
      type,
    });

    return model.instance<Account>();
  }

  public static async retrieveWithTypeAndExternalId(
    type: string,
    external_id: string
  ): Promise<Account> {
    const model = await super.retrieve(MODELS.ACCOUNT, {
      type, external_id,
    });

    return model.instance<Account>();
  }

  public async delete(): Promise<void> {
    await Database.pool.query(`delete from "accounts" where "id" = $1`, [
      this.id,
    ]);
  }

  ///////////////
  // UTILITIES //
  ///////////////

  public static async exists(
    user: User | INotExpandedResource | string,
    type: string
  ): Promise<boolean> {
    const result = await Database.pool.query(
      `
      select 1
      from "accounts"
      where
        "user" = $1
        and
        "type" = $2
      limit 1
      `,
      [typeof user === "string" ? user : user.id, type]
    );

    return result.rows.length > 0;
  }

  public static async existsWithTypeAndExternalId(
    type: string,
    externalId: string
  ): Promise<boolean> {
    const result = await Database.pool.query(
      `
      select 1
      from "accounts"
      where
        "type" = $1
        and
        "external_id" = $2
      limit 1
      `,
      [type, externalId]
    );

    return result.rows.length > 0;
  }

  public static async forUser(
    user: User | INotExpandedResource | string,
    expand?: string[]
  ): Promise<Account[]> {
    const result = await Database.pool.query(
      `
      select *
      from "accounts"
      where "user" = $1
      `,
      [typeof user === "string" ? user : user.id]
    );

    return Promise.all(result.rows.map((_) => super.deserialize<Account>(MODELS.ACCOUNT, _, expand)));
  }
}
