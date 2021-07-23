import { ExpandQuery } from "../common/ExpandQuery";
import { INotExpandedResource } from "../common/INotExpandedResource";
import { Config } from "../config/Config";
import { Model } from "../config/Model";
import { ACCOUNT_MODEL, IAccount, ICreateAccount } from "../types/account";
import Utilities from "../utilities/Utilities";
import { User } from "./User";

export class Account extends Model {
  public constructor(protected readonly record: IAccount) {
    super(ACCOUNT_MODEL, data);
  }

  ////////////////
  // PROPERTIES //
  ////////////////

  public get id(): string {
    return this.record.id;
  }

  public get user(): User | INotExpandedResource {
    return this.record.user;
  }

  public get type(): string {
    return this.record.type;
  }

  public get external_id(): string {
    return this.record.external_id;
  }

  //////////
  // CRUD //
  //////////

  public static async create({
    user,
    type,
    external_id,
  }: ICreateAccount): Promise<INotExpandedResource> {
    const id = Utilities.id(Config.ID_PREFIXES.ACCOUNT);

    await super._create(ACCOUNT_MODEL, {
      id,
      user: typeof user === "string" ? user : user.id,
      type,
      external_id,
    });

    return { id };
  }

  public static async retrieve(id: string): Promise<Account> {
    return super._retrieve<Account>({
      kind: ACCOUNT_MODEL,
      filter: { id },
    });
  }

  public static async retrieveWithUserAndType(
    user: User | INotExpandedResource | string,
    type: string
  ): Promise<Account> {
    return super._retrieve<Account>({
      kind: ACCOUNT_MODEL,
      filter: {
        user: typeof user === "string" ? user : user.id,
        type,
      },
    });
  }

  public static async retrieveWithTypeAndExternalId(
    type: string,
    external_id: string
  ): Promise<Account> {
    return super._retrieve<Account>({
      kind: ACCOUNT_MODEL,
      filter: {
        type,
        external_id,
      },
    });
  }

  public async delete(): Promise<void> {
    return super._delete({ id: this.id });
  }

  ///////////////
  // UTILITIES //
  ///////////////

  public static async existsWithUserAndType(
    user: User | INotExpandedResource | string,
    type: string
  ): Promise<boolean> {
    return super._exists({
      kind: ACCOUNT_MODEL,
      filter: {
        user: typeof user === "string" ? user : user.id,
        type,
      },
    });
  }

  public static async existsWithTypeAndExternalId(
    type: string,
    external_id: string
  ): Promise<boolean> {
    return super._exists({
      kind: ACCOUNT_MODEL,
      filter: {
        type,
        external_id,
      },
    });
  }

  public static async forUser(
    user: User | INotExpandedResource | string,
    expand?: ExpandQuery
  ): Promise<Account[]> {
    return super._for<Account>({
      kind: ACCOUNT_MODEL,
      filter: {
        key: "user",
        value: typeof user === "string" ? user : user.id,
      },
      expand,
    });
  }
}
