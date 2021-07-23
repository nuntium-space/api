import Boom from "@hapi/boom";
import { ExpandQuery } from "../common/ExpandQuery";
import { INotExpandedResource } from "../common/INotExpandedResource";
import { ISerializable } from "../common/ISerializable";
import { Config } from "../config/Config";
import { Model } from "../config/Model";
import {
  ISerializedOrganization,
  ICreateOrganization,
  IUpdateOrganization,
  IOrganization,
  ORGANIZATION_MODEL,
} from "../types/organization";
import Database from "../utilities/Database";
import Utilities from "../utilities/Utilities";
import { User } from "./User";

export class Organization
  extends Model
  implements ISerializable<ISerializedOrganization>
{
  public constructor(protected readonly record: IOrganization) {
    super(ORGANIZATION_MODEL, record);
  }

  ////////////////
  // PROPERTIES //
  ////////////////

  public get id(): string {
    return this.record.id;
  }

  public get name(): string {
    return this.record.name;
  }

  public get user(): User | INotExpandedResource {
    return this.record.user;
  }

  public get stripe_account_id(): string {
    return this.record.stripe_account_id;
  }

  public get stripe_account_enabled(): boolean {
    return this.record.stripe_account_enabled;
  }

  public static async create(
    data: ICreateOrganization,
    user: User
  ): Promise<INotExpandedResource> {
    if (await Organization.existsWithName(data.name)) {
      throw Boom.badRequest(undefined, [
        {
          field: "name",
          error: "custom.organization.already_exists",
        },
      ]);
    }

    const id = Utilities.id(Config.ID_PREFIXES.ORGANIZATION);

    const account = await Config.STRIPE.accounts
      .create({
        type: "express",
        email: user.email,
        metadata: {
          organization_id: id,
        },
      })
      .catch(() => {
        throw Boom.badImplementation();
      });

    await super._create(ORGANIZATION_MODEL, {
      id,
      name: data.name,
      user: user.id,
      stripe_account_id: account.id,
    });

    return { id };
  }

  public static async retrieve(
    id: string,
    expand?: ExpandQuery
  ): Promise<Organization> {
    return super._retrieve({
      kind: ORGANIZATION_MODEL,
      filter: { id },
      expand,
    });
  }

  public static async existsWithName(name: string): Promise<boolean> {
    return super._exists({ kind: ORGANIZATION_MODEL, filter: { name } });
  }

  public async update(data: IUpdateOrganization): Promise<void> {
    this.record.name = data.name ?? this.name;
    this.record.stripe_account_enabled =
      data.stripe_account_enabled ?? this.stripe_account_enabled;

    await Database.pool
      .query(
        `
        update "organizations"
        set
          "name" = $1,
          "stripe_account_enabled" = $2
        where
          "id" = $3
        `,
        [this.name, this.stripe_account_enabled, this.id]
      )
      .catch(() => {
        throw Boom.badRequest();
      });
  }

  public async delete(): Promise<void> {
    return super._delete({ id: this.id });
  }

  public static async forUser(
    user: User,
    expand?: ExpandQuery
  ): Promise<Organization[]> {
    return super._for({
      kind: ORGANIZATION_MODEL,
      filter: { key: "user", value: user.id },
      expand,
    });
  }

  public serialize(options?: {
    for?: User | INotExpandedResource;
  }): ISerializedOrganization {
    if (options?.for?.id !== this.user.id) {
      return { id: this.id } as any;
    }

    return {
      id: this.id,
      name: this.name,
      user:
        this.user instanceof User
          ? this.user.serialize({ for: options?.for })
          : this.user,
      stripe_account_enabled: this.stripe_account_enabled,
    };
  }
}
