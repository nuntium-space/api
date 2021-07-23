import Boom from "@hapi/boom";
import { INotExpandedResource } from "../common/INotExpandedResource";
import { ISerializable } from "../common/ISerializable";
import { Config } from "../config/Config";
import { Model } from "../config/Model";
import {
  ISerializedBundle,
  ICreateBundle,
  IUpdateBundle,
  IBundle,
  BUNDLE_MODEL,
} from "../types/bundle";
import Database from "../utilities/Database";
import Utilities from "../utilities/Utilities";
import { Organization } from "./Organization";
import { Publisher } from "./Publisher";
import { User } from "./User";

export class Bundle extends Model implements ISerializable<ISerializedBundle> {
  public constructor(protected readonly record: IBundle) {
    super(BUNDLE_MODEL, record);
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

  public get organization(): Organization | INotExpandedResource {
    return this.record.organization;
  }

  public get active(): boolean {
    return this.record.active;
  }

  public get stripe_product_id(): string | null {
    return this.record.stripe_product_id;
  }

  //////////
  // CRUD //
  //////////

  public static async create(
    data: ICreateBundle,
    organization: Organization
  ): Promise<INotExpandedResource> {
    if (await Bundle.existsWithNameAndOrganization(data.name, organization)) {
      throw Boom.conflict(undefined, [
        {
          field: "name",
          error: "custom.bundle.already_exists",
        },
      ]);
    }

    const id = Utilities.id(Config.ID_PREFIXES.BUNDLE);

    const client = await Database.pool.connect();
    await client.query("begin");

    await client
      .query(
        `
        insert into "bundles"
          ("id", "name", "organization", "active")
        values
          ($1, $2, $3, $4)
        `,
        [id, data.name, organization.id, true]
      )
      .catch(async () => {
        await client.query("rollback");

        throw Boom.badRequest();
      });

    await Config.STRIPE.products
      .create({
        name: data.name,
        tax_code: "txcd_10304100", // Digital newspaper -- subscription
        metadata: {
          bundle_id: id,
        },
      })
      .catch(async () => {
        await client.query("rollback");

        throw Boom.badRequest();
      });

    await client.query("commit");
    client.release();

    return { id };
  }

  public static async retrieve(id: string, expand?: string[]): Promise<Bundle> {
    return super._retrieve({
      kind: BUNDLE_MODEL,
      filter: { id },
      expand,
    });
  }

  public async update(data: IUpdateBundle): Promise<void> {
    if (
      data.name &&
      (await Bundle.existsWithNameAndOrganization(
        data.name,
        this.organization.id
      ))
    ) {
      throw Boom.conflict(undefined, [
        {
          field: "name",
          error: "custom.bundle.already_exists",
        },
      ]);
    } else if (!this.stripe_product_id) {
      throw Boom.badImplementation();
    }

    this.record.name = data.name ?? this.name;
    this.record.active = data.active ?? this.active;

    const client = await Database.pool.connect();

    await client.query("begin");

    await client
      .query(
        `
        update "bundles"
        set
          "name" = $1,
          "active" = $2
        where
          "id" = $3
        `,
        [this.name, this.active, this.id]
      )
      .catch(async () => {
        await client.query("rollback");

        throw Boom.badRequest();
      });

    await Config.STRIPE.products
      .update(this.stripe_product_id, {
        name: this.name,
        active: this.active,
      })
      .catch(async () => {
        await client.query("rollback");

        throw Boom.badRequest();
      });

    await client.query("commit");

    client.release();
  }

  public async addPublisher(publisher: Publisher): Promise<void> {
    if (publisher.organization.id !== this.organization.id) {
      throw Boom.forbidden(undefined, [
        {
          field: "publisher",
          error: `Cannot add publisher '${publisher.id}' to bundle ${this.id}`,
        },
      ]);
    }

    await Database.pool
      .query(
        `insert into "bundles_publishers" ("bundle", "publisher") values ($1, $2)`,
        [this.id, publisher.id]
      )
      .catch(() => {
        throw Boom.badRequest(undefined, [
          {
            field: "publisher",
            error: `Cannot add publisher '${publisher.id}' to bundle ${this.id}`,
          },
        ]);
      });
  }

  public async removePublisher(publisher: Publisher): Promise<void> {
    await Database.pool.query(
      `delete from "bundles_publishers" where "bundle" = $1 and "publisher" = $2`,
      [this.id, publisher.id]
    );
  }

  public static async existsWithNameAndOrganization(
    name: string,
    organization: Organization | string
  ): Promise<boolean> {
    return super._exists({
      kind: BUNDLE_MODEL,
      filter: {
        name,
        organization,
      },
    });
  }

  public static async forOrganization(
    organization: Organization,
    expand?: string[]
  ): Promise<Bundle[]> {
    return super._for({
      kind: BUNDLE_MODEL,
      filter: { key: "organization", value: organization },
      expand,
    });
  }

  public static async forPublisher(
    publisher: Publisher,
    expand?: string[]
  ): Promise<Bundle[]> {
    const result = await Database.pool.query(
      `
      select b.*
      from
        bundles_publishers as bp
        inner join
        v_active_bundles as b
        on bp.bundle = b.id
      where bp.publisher = $1`,
      [publisher.id]
    );

    return Promise.all(
      result.rows.map((row) =>
        Bundle.deserialize<Bundle>(BUNDLE_MODEL, row, expand)
      )
    );
  }

  public serialize(options?: {
    for?: User | INotExpandedResource;
  }): ISerializedBundle {
    console.log(super._serialize());

    return {
      id: this.id,
      name: this.name,
      organization:
        this.organization instanceof Organization
          ? this.organization.serialize({ for: options?.for })
          : this.organization,
      active: this.active,
    };
  }
}
