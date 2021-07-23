import Boom from "@hapi/boom";
import S3 from "aws-sdk/clients/s3";
import imageSize from "image-size";
import imageType from "image-type";
import jdenticon from "jdenticon";
import { INotExpandedResource } from "../common/INotExpandedResource";
import { ISerializable } from "../common/ISerializable";
import { Config } from "../config/Config";
import { Model } from "../config/Model";
import {
  ISerializedUser,
  ICreateUser,
  IUpdateUser,
  IUserSettings,
  IUpdateUserSettings,
  UserType,
  USER_MODEL,
  IUser,
} from "../types/user";
import Database from "../utilities/Database";
import Utilities from "../utilities/Utilities";
import { Bundle } from "./Bundle";
import { Publisher } from "./Publisher";

export class User extends Model implements ISerializable<ISerializedUser> {
  public constructor(protected readonly record: IUser) {
    super(USER_MODEL, data);
  }

  ////////////////
  // PROPERTIES //
  ////////////////

  public get id(): string {
    return this.record.id;
  }

  public get type(): UserType {
    return this.record.type;
  }

  public get full_name(): string | null {
    return this.record.full_name;
  }

  public get email(): string {
    return this.record.email;
  }

  public get stripe_customer_id(): string | null {
    return this.record.stripe_customer_id;
  }

  public static async create(data: ICreateUser): Promise<INotExpandedResource> {
    const id = Utilities.id(Config.ID_PREFIXES.USER);

    const client = await Database.pool.connect();
    await client.query("begin");

    const result = await client
      .query(
        `
        insert into "users"
          ("id", "full_name", "email")
        values
          ($1, $2, $3)
        returning *
        `,
        [id, data.full_name, data.email]
      )
      .catch(async () => {
        await client.query("rollback");

        throw Boom.badRequest();
      });

    await Config.STRIPE.customers
      .create({
        email: data.email,
        metadata: {
          user_id: id,
        },
      })
      .catch(async () => {
        await client.query("rollback");

        throw Boom.badRequest();
      });

    await client.query("commit");
    client.release();

    const user = await super.deserialize<User>(USER_MODEL, result.rows[0]);

    const png = jdenticon.toPng(user.id, 500, { backColor: "#ffffff" });
    await user.setImage(png);

    return { id };
  }

  public static async retrieve(id: string): Promise<User> {
    return super._retrieve({ kind: USER_MODEL, filter: { id } });
  }

  public static async retrieveWithEmail(email: string): Promise<User> {
    return super._retrieve({ kind: USER_MODEL, filter: { email } });
  }

  public static async retrieveWithCustomerId(
    stripe_customer_id: string
  ): Promise<User> {
    return super._retrieve({
      kind: USER_MODEL,
      filter: { stripe_customer_id },
    });
  }

  public static async existsWithEmail(email: string): Promise<boolean> {
    return super._exists({ kind: USER_MODEL, filter: { email } });
  }

  public async update(data: IUpdateUser): Promise<void> {
    this.record.full_name = data.full_name ?? this.full_name;
    this.record.email = data.email ?? this.email;

    const client = await Database.pool.connect();
    await client.query("begin");

    await client
      .query(
        `
        update "users"
        set
          "full_name" = $1,
          "email" = $2
        where
          "id" = $3
        `,
        [this.full_name, this.email, this.id]
      )
      .catch(async () => {
        await client.query("rollback");

        throw Boom.badRequest();
      });

    if (this.stripe_customer_id) {
      await Config.STRIPE.customers
        .update(this.stripe_customer_id, {
          name: this.full_name ?? undefined,
          email: this.email,
        })
        .catch(async () => {
          await client.query("rollback");

          throw Boom.badRequest();
        });
    }

    await client.query("commit");
    client.release();
  }

  public async delete(): Promise<void> {
    if (!(await this.canBeDeleted())) {
      throw Boom.forbidden(undefined, [
        {
          field: "user",
          error: `Cannot delete user '${this.id}'`,
        },
      ]);
    }

    const client = await Database.pool.connect();
    await client.query("begin");

    await super._delete({ id: this.id });

    if (this.stripe_customer_id) {
      await Config.STRIPE.customers
        .del(this.stripe_customer_id)
        .catch(async () => {
          await client.query("rollback");

          throw Boom.badRequest();
        });
    }

    await client.query("commit");
    client.release();
  }

  public async removeDefaultPaymentMethod(): Promise<void> {
    await Database.pool
      .query(`delete from "default_payment_methods" where "user" = $1`, [
        this.id,
      ])
      .catch(() => {
        throw Boom.badImplementation();
      });
  }

  public async retrieveSettings(): Promise<IUserSettings> {
    const {
      rows: [row],
    } = await Database.pool
      .query(
        `
        select "language"
        from "user_settings"
        where "user" = $1
        `,
        [this.id]
      )
      .catch(() => {
        throw Boom.badImplementation();
      });

    return {
      language: row?.language ?? null,
    };
  }

  public async hasSettings(): Promise<boolean> {
    const { rowCount } = await Database.pool
      .query(
        `
        select "user"
        from "user_settings"
        where "user" = $1
        limit 1
        `,
        [this.id]
      )
      .catch(() => {
        throw Boom.badImplementation();
      });

    return rowCount > 0;
  }

  public async updateSettings(data: IUpdateUserSettings): Promise<void> {
    const settings = await this.retrieveSettings();

    settings.language = data.language ?? settings.language;

    if (!Config.LANGUAGES.find((l) => l.id === settings.language)) {
      throw Boom.badData(undefined, [
        {
          field: "language",
          error: `Unsupported language: '${data.language}'`,
        },
      ]);
    }

    const hasSettings = await this.hasSettings();

    const client = await Database.pool.connect();

    await client.query("begin");

    const query = hasSettings
      ? `
        update "user_settings"
        set
          "language" = $1
        where
          "user" = $2
        `
      : `
        insert into "user_settings"
          ("user", "language")
        values
          ($1, $2)
        `;

    const params = hasSettings
      ? [settings.language, this.id]
      : [this.id, settings.language];

    await client.query(query, params).catch(async () => {
      await client.query("rollback");

      throw Boom.badImplementation();
    });

    if (this.stripe_customer_id && settings.language) {
      await Config.STRIPE.customers
        .update(this.stripe_customer_id, {
          preferred_locales: [settings.language],
        })
        .catch(async () => {
          await client.query("rollback");

          throw Boom.badRequest();
        });
    }

    await client.query("commit");

    client.release();
  }

  public async canBeDeleted(): Promise<boolean> {
    const authorCountResult = await Database.pool.query(
      `
      select 1
      from "authors"
      where "user" = $1
      limit 1
      `,
      [this.id]
    );

    if (authorCountResult.rows.length > 0) {
      return false;
    }

    const authorCountForOwnedPublishersResult = await Database.pool.query(
      `
      select 1
      from
        "publishers" as "p"
        inner join
        "organizations" as "o"
        on "p"."organization" = "o"."id"
        inner join
        "authors" as "a"
        on "a"."publisher" = "p"."id"
      where "o"."user" = $1
      limit 1
      `,
      [this.id]
    );

    return authorCountForOwnedPublishersResult.rows.length === 0;
  }

  public async canSubscribeToBundle(bundle: Bundle): Promise<boolean> {
    const result = await Database.pool.query(
      `
      select 1
      from
        "subscriptions" as s
        inner join
        "prices" as p
        on s.price = p.id
      where
        "s"."deleted" = false
        and
        "s"."user" = $1
        and
        "p"."bundle" = $2
      limit 1
      `,
      [this.id, bundle.id]
    );

    return result.rows.length === 0;
  }

  public async isAuthorOfPublisher(publisher: Publisher): Promise<boolean> {
    const result = await Database.pool.query(
      `
      select 1
      from "authors"
      where
        "user" = $1
        and
        "publisher" = $2
      limit 1
      `,
      [this.id, publisher.id]
    );

    return result.rows.length > 0;
  }

  public async isSubscribedToPublisher(publisher: Publisher): Promise<boolean> {
    /**
     * The owner of the publisher is considered subscribed to it
     */
    if (await publisher.isOwnedByUser(this)) {
      return true;
    }

    const result = await Database.pool.query(
      `
      select 1
      from
        "v_active_subscriptions" as s
        inner join
        "prices" as p
        on s.price = p.id
        inner join
        "bundles_publishers" as bp
        on p.bundle = bp.bundle
      where
        "user" = $1
        and
        "publisher" = $2
      limit 1
      `,
      [this.id, publisher.id]
    );

    return result.rows.length > 0;
  }

  public async hasActiveSubscriptions(): Promise<boolean> {
    const result = await Database.pool.query(
      `
      select 1
      from "v_active_subscriptions"
      where "user" = $1
      limit 1
      `,
      [this.id]
    );

    return result.rows.length > 0;
  }

  public async setImage(image: any): Promise<{ url: string }> {
    const { mime } = imageType(image) ?? { mime: "" };

    if (!Config.PROFILE_IMAGE_SUPPORTED_MIME_TYPES.includes(mime)) {
      throw Boom.unsupportedMediaType(undefined, [
        {
          field: "image",
          error: "custom.publisher.image.not_supported",
        },
      ]);
    }

    const { width, height } = imageSize(image);

    if (width !== height) {
      throw Boom.badData(undefined, [
        {
          field: "image",
          error: "custom.publisher.image.must_be_square",
        },
      ]);
    }

    const s3Client = new S3({
      endpoint: Config.AWS_ENDPOINT,
      s3ForcePathStyle: true,
    });

    const upload = await s3Client
      .upload({
        Bucket: process.env.AWS_PROFILE_IMAGES_BUCKET_NAME ?? "",
        Key: `users/${this.id}`,
        Body: image,
      })
      .promise()
      .catch(() => {
        throw Boom.badImplementation();
      });

    return { url: upload.Location };
  }

  public serialize(options?: {
    /**
     * The authenticated user (or just its ID) that requested this user's data
     *
     * This param is used to remove sensitive information from
     * the response if the authenticated user does not match
     * the user that will be serialized
     */
    for?: User | INotExpandedResource;
  }): ISerializedUser {
    const s3Client = new S3({
      credentials: Config.AWS_CREDENTIALS,
      endpoint: Config.AWS_ENDPOINT,
    });

    const imageUrl = new URL(s3Client.endpoint.href);
    imageUrl.pathname = `${process.env.AWS_PROFILE_IMAGES_BUCKET_NAME}/users/${this.id}`;

    let response: any = {
      id: this.id,
      full_name: this.full_name,
      imageUrl: imageUrl.toString(),
    };

    if (options?.for?.id === this.id) {
      response = {
        ...response,
        type: this.type,
        email: this.email,
      };
    }

    return response;
  }
}
