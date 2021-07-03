import S3 from "aws-sdk/clients/s3";
import Boom from "@hapi/boom";
import crypto from "crypto";
import { INotExpandedResource } from "../common/INotExpandedResource";
import { ISerializable } from "../common/ISerializable";
import { Config } from "../config/Config";
import Database from "../utilities/Database";
import Utilities from "../utilities/Utilities";
import { Bundle } from "./Bundle";
import { Organization } from "./Organization";
import { User } from "./User";
import { ISerializedPublisher, ICreatePublisher, IUpdatePublisher, IDatabasePublisher } from "../types/publisher";
import imageType from "image-type";
import imageSize from "image-size";
import jdenticon from "jdenticon";

export class Publisher implements ISerializable<ISerializedPublisher>
{
    private constructor
    (
        public readonly _id: string,
        private _name: string,
        private _url: string,
        public readonly organization: Organization,
        public readonly verified: boolean,
        public readonly dns_txt_value: string,
    )
    {}

    public get id(): string
    {
        return this._id;
    }

    public get name(): string
    {
        return this._name;
    }

    public get url(): string
    {
        return this._url;
    }

    public static async create(data: ICreatePublisher, organization: Organization): Promise<INotExpandedResource>
    {
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
                    crypto.randomBytes(Config.PUBLISHER_DNS_TXT_VALUE_BYTES).toString("hex"),
                ],
            )
            .catch(async () =>
            {
                await client.query("rollback");

                throw Boom.badRequest();
            });

        await Config.ELASTICSEARCH
            .index({
                index: "publishers",
                id,
                body: {
                    name: data.name,
                },
            })
            .catch(async () =>
            {
                await client.query("rollback");

                throw Boom.badImplementation();
            });

        await client.query("commit");
        client.release();

        const publisher = await Publisher.deserialize(result.rows[0]);

        const png = jdenticon.toPng(publisher.id, 500, { backColor: "#ffffff" });
        publisher.setImage(png);

        return { id };
    }

    public static async retrieve(id: string): Promise<Publisher>
    {
        const result = await Database.pool.query(
            `select * from "publishers" where "id" = $1`,
            [ id ],
        );

        if (result.rowCount === 0)
        {
            throw Boom.notFound();
        }

        return Publisher.deserialize(result.rows[0]);
    }

    public static async retrieveMultiple(ids: string[]): Promise<Publisher[]>
    {
        const result = await Database.pool
            .query(
                `select * from "publishers" where "id" = any ($1)`,
                [ ids ],
            );

        return Promise.all(result.rows.map(Publisher.deserialize));
    }

    public async update(data: IUpdatePublisher): Promise<void>
    {
        const shouldInvalidateDomainVerification = (data.url ?? this.url) !== this.url;

        this._name = data.name ?? this.name;
        this._url = data.url ?? this.url;

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
                [
                    this.name,
                    this.url,
                    !shouldInvalidateDomainVerification,
                    this.id,
                ],
            )
            .catch(async () =>
            {
                await client.query("rollback");

                throw Boom.badRequest();
            });

        await Config.ELASTICSEARCH
            .update({
                index: "publishers",
                id: this.id,
                body: {
                    doc: {
                        name: this.name,
                    },
                },
            })
            .catch(async () =>
            {
                await client.query("rollback");

                throw Boom.badImplementation();
            });

        await client.query("commit");

        client.release();
    }

    public async delete(): Promise<void>
    {
        const client = await Database.pool.connect();
        await client.query("begin");

        await client
            .query(
                `delete from "publishers" where "id" = $1`,
                [ this.id ],
            )
            .catch(async () =>
            {
                await client.query("rollback");

                throw Boom.badImplementation();
            });

        await Config.ELASTICSEARCH
            .delete({
                index: "publishers",
                id: this.id,
            })
            .catch(async () =>
            {
                await client.query("rollback");

                throw Boom.badImplementation();
            });

        const s3Client = new S3({
            endpoint: Config.AWS_ENDPOINT,
            s3ForcePathStyle: true,
        });

        await s3Client
            .deleteObject({
                Bucket: process.env.AWS_PUBLISHER_ICONS_BUCKET_NAME ?? "",
                Key: this.id,
            })
            .promise()
            .catch(async () =>
            {
                await client.query("rollback");

                throw Boom.badImplementation();
            });

        await client.query("commit");
        client.release();
    }

    public static async forBundle(bundle: Bundle): Promise<Publisher[]>
    {
        const result = await Database.pool.query(
            `
            select p.*
            from
                bundles_publishers as bp
                inner join
                publishers as p
                on bp.publisher = p.id
            where bp.bundle = $1
            `,
            [ bundle.id ],
        );

        return Promise.all(result.rows.map(row => Publisher.deserialize(row)));
    }

    public static async forOrganization(organization: Organization, options: {
        not_in_bundle: string,
    }): Promise<Publisher[]>
    {
        let query = `select * from "publishers" where "organization" = $1`;
        let params = [ organization.id ];

        if (options.not_in_bundle)
        {
            query =
            `
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

            params = [ options.not_in_bundle, organization.id ];
        }

        const result = await Database.pool.query(query, params);

        return Promise.all(result.rows.map(Publisher.deserialize));
    }

    public isOwnedByUser(user: User): boolean
    {
        return this.organization.owner.id === user.id;
    }

    public async setImage(image: any): Promise<{ url: string }>
    {
        const { mime } = imageType(image) ?? { mime: "" };

        if (!Config.PUBLISHER_IMAGE_SUPPORTED_MIME_TYPES.includes(mime))
        {
            throw Boom.unsupportedMediaType(undefined, [
                {
                    field: "image",
                    error: "custom.publisher.image.not_supported",
                },
            ]);
        }

        const { width, height } = imageSize(image);

        if (width !== height)
        {
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
                Bucket: process.env.AWS_PUBLISHER_ICONS_BUCKET_NAME ?? "",
                Key: this.id,
                Body: image,
            })
            .promise()
            .catch(() =>
            {
                throw Boom.badImplementation();
            });

        return { url: upload.Location };
    }

    public serialize(options?: {
        for?: User | INotExpandedResource,
    }): ISerializedPublisher
    {
        const s3Client = new S3({
            credentials: Config.AWS_CREDENTIALS,
            endpoint: Config.AWS_ENDPOINT,
        });

        const imageUrl = `${s3Client.endpoint.href}/${process.env.AWS_PUBLISHER_ICONS_BUCKET_NAME}/${this.id}`;

        return {
            id: this.id,
            name: this.name,
            url: this.url,
            organization: this.organization.serialize({ for: options?.for }),
            verified: this.verified,
            imageUrl,
        };
    }

    private static async deserialize(data: IDatabasePublisher): Promise<Publisher>
    {
        const organization = await Organization.retrieve(data.organization);

        return new Publisher(
            data.id,
            data.name,
            data.url,
            organization,
            data.verified,
            data.dns_txt_value,
        );
    }
}
