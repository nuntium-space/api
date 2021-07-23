import S3 from "aws-sdk/clients/s3";
import Boom from "@hapi/boom";
import { randomBytes } from "crypto";
import { INotExpandedResource } from "../common/INotExpandedResource";
import { ISerializable } from "../common/ISerializable";
import { Config } from "../config/Config";
import Database from "../utilities/Database";
import Utilities from "../utilities/Utilities";
import { Bundle } from "./Bundle";
import { Organization } from "./Organization";
import { User } from "./User";
import {
  ISerializedPublisher,
  ICreatePublisher,
  IUpdatePublisher,
  IPublisher,
  PUBLISHER_MODEL,
} from "../types/publisher";
import imageType from "image-type";
import imageSize from "image-size";
import jdenticon from "jdenticon";
import { Model } from "../config/Model";
import { ExpandQuery } from "../common/ExpandQuery";

export class Publisher
  extends Model
  implements ISerializable<ISerializedPublisher>
{
  public constructor(protected readonly record: IPublisher) {
    super(PUBLISHER_MODEL, data);
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

  public get url(): string {
    return this.record.url;
  }

  public get organization(): Organization | INotExpandedResource {
    return this.record.organization;
  }

  public get verified(): boolean {
    return this.record.verified;
  }

  public get dns_txt_value(): string {
    return this.record.dns_txt_value;
  }

  public static async create(
    data: ICreatePublisher,
    organization: Organization
  ): Promise<INotExpandedResource> {
    const id = Utilities.id(Config.ID_PREFIXES.PUBLISHER);

    const client = await Database.pool.connect();
    await client.query("begin");

    const result = await client
      .query(
        `
        insert into "publishers"
          ("id", "name", "url", "organization", "verified", "dns_txt_value")
        values
          ($1, $2, $3, $4, $5, $6)
        returning *
        `,
        [
          id,
          data.name,
          data.url,
          organization.id,
          false,
          randomBytes(Config.PUBLISHER_DNS_TXT_VALUE_BYTES).toString("hex"),
        ]
      )
      .catch(async () => {
        await client.query("rollback");

        throw Boom.badRequest();
      });

    await Config.ELASTICSEARCH.index({
      index: "publishers",
      id,
      body: {
        name: data.name,
      },
    }).catch(async () => {
      await client.query("rollback");

      throw Boom.badImplementation();
    });

    await client.query("commit");
    client.release();

    const publisher = await super.deserialize<Publisher>(
      PUBLISHER_MODEL,
      result.rows[0]
    );

    const png = jdenticon.toPng(publisher.id, 500, { backColor: "#ffffff" });
    await publisher.setImage(png);

    return { id };
  }

  public static async retrieve(
    id: string,
    expand?: ExpandQuery
  ): Promise<Publisher> {
    return super._retrieve({ kind: PUBLISHER_MODEL, filter: { id }, expand });
  }

  public static async retrieveWithName(
    name: string,
    expand?: ExpandQuery
  ): Promise<Publisher> {
    return super._retrieve({ kind: PUBLISHER_MODEL, filter: { name }, expand });
  }

  public static async retrieveMultiple(
    ids: string[],
    expand?: ExpandQuery
  ): Promise<Publisher[]> {
    const result = await Database.pool.query(
      `select * from "publishers" where "id" = any ($1)`,
      [ids]
    );

    return Promise.all(
      result.rows.map((_) =>
        super.deserialize<Publisher>(PUBLISHER_MODEL, _, expand)
      )
    );
  }

  public async update(data: IUpdatePublisher): Promise<void> {
    const shouldInvalidateDomainVerification =
      (data.url ?? this.url) !== this.url;

    this.record.name = data.name ?? this.name;
    this.record.url = data.url ?? this.url;

    const client = await Database.pool.connect();

    await client.query("begin");

    await client
      .query(
        `
        update "publishers"
        set
          "name" = $1,
          "url" = $2,
          "verified" = $3
        where
          "id" = $4
        `,
        [this.name, this.url, !shouldInvalidateDomainVerification, this.id]
      )
      .catch(async () => {
        await client.query("rollback");

        throw Boom.badRequest();
      });

    await Config.ELASTICSEARCH.update({
      index: "publishers",
      id: this.id,
      body: {
        doc: {
          name: this.name,
        },
      },
    }).catch(async () => {
      await client.query("rollback");

      throw Boom.badImplementation();
    });

    await client.query("commit");

    client.release();
  }

  public async delete(): Promise<void> {
    const client = await Database.pool.connect();
    await client.query("begin");

    await super._delete({ id: this.id });

    await Config.ELASTICSEARCH.delete({
      index: "publishers",
      id: this.id,
    }).catch(async () => {
      await client.query("rollback");

      throw Boom.badImplementation();
    });

    const s3Client = new S3({
      endpoint: Config.AWS_ENDPOINT,
      s3ForcePathStyle: true,
    });

    await s3Client
      .deleteObject({
        Bucket: process.env.AWS_PROFILE_IMAGES_BUCKET_NAME ?? "",
        Key: this.id,
      })
      .promise()
      .catch(async () => {
        await client.query("rollback");

        throw Boom.badImplementation();
      });

    await client.query("commit");
    client.release();
  }

  public static async forBundle(
    bundle: Bundle,
    expand?: ExpandQuery
  ): Promise<Publisher[]> {
    return super._for({
      kind: PUBLISHER_MODEL,
      filter: { key: "bundle", value: bundle.id },
      expand,
    });
  }

  public static async forOrganization(
    organization: Organization,
    options: {
      not_in_bundle: string;
    },
    expand?: ExpandQuery
  ): Promise<Publisher[]> {
    let query = `select * from "publishers" where "organization" = $1`;
    let params = [organization.id];

    if (options.not_in_bundle) {
      query = `
      select *
      from publishers
      where
        id not in
          (
            select publisher
            from bundles_publishers
            where bundle = $1
          )
        and
        organization = $2
      `;

      params = [options.not_in_bundle, organization.id];
    }

    const result = await Database.pool.query(query, params);

    return Promise.all(
      result.rows.map((_) =>
        super.deserialize<Publisher>(PUBLISHER_MODEL, _, expand)
      )
    );
  }

  public async isOwnedByUser(user: User): Promise<boolean> {
    const organization =
      this.organization instanceof Organization
        ? this.organization
        : await Organization.retrieve(this.organization.id);

    return organization.user.id === user.id;
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
        Key: `publishers/${this.id}`,
        Body: image,
      })
      .promise()
      .catch(() => {
        throw Boom.badImplementation();
      });

    return { url: upload.Location };
  }

  public serialize(options?: {
    for?: User | INotExpandedResource;
  }): ISerializedPublisher {
    const s3Client = new S3({
      credentials: Config.AWS_CREDENTIALS,
      endpoint: Config.AWS_ENDPOINT,
    });

    const imageUrl = new URL(s3Client.endpoint.href);
    imageUrl.pathname = `${process.env.AWS_PROFILE_IMAGES_BUCKET_NAME}/publishers/${this.id}`;

    return {
      id: this.id,
      name: this.name,
      url: this.url,
      organization:
        this.organization instanceof Organization
          ? this.organization.serialize({ for: options?.for })
          : this.organization,
      verified: this.verified,
      imageUrl: imageUrl.toString(),
    };
  }
}
