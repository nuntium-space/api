import AWS from "aws-sdk";
import { promises as dns } from "dns";
import Boom from "@hapi/boom";
import { ServerRoute } from "@hapi/hapi";
import Joi from "joi";
import { Config } from "../../config/Config";
import { ID_SCHEMA, PUBLISHER_CREATE_SCHEMA, PUBLISHER_SCHEMA, PUBLISHER_UPDATE_SCHEMA, STRING_SCHEMA } from "../../config/schemas";
import { Bundle } from "../../models/Bundle";
import { Organization } from "../../models/Organization";
import { Publisher } from "../../models/Publisher";
import { User } from "../../models/User";
import Database from "../../utilities/Database";
import imageType from "image-type";
import imageSize from "image-size";

export default <ServerRoute[]>[
    {
        method: "GET",
        path: "/publishers/{id}",
        options: {
            validate: {
                params: Joi.object({
                    id: ID_SCHEMA(Config.ID_PREFIXES.PUBLISHER).required(),
                }),
            },
            response: {
                schema: PUBLISHER_SCHEMA,
            },
        },
        handler: async (request, h) =>
        {
            const authenticatedUser = request.auth.credentials.user as User;

            const publisher = await Publisher.retrieve(request.params.id);

            return {
                ...publisher.serialize({ for: authenticatedUser }),
                __metadata: {
                    is_author: await authenticatedUser.isAuthorOfPublisher(publisher),
                    is_subscribed: await authenticatedUser.isSubscribedToPublisher(publisher),
                },
            };
        },
    },
    {
        method: "GET",
        path: "/publishers/{id}/verification/data",
        options: {
            validate: {
                params: Joi.object({
                    id: ID_SCHEMA(Config.ID_PREFIXES.PUBLISHER).required(),
                }),
            },
            response: {
                schema: Joi.object({
                    dns: Joi.object({
                        record: STRING_SCHEMA.required(),
                    }).required(),
                }),
            },
        },
        handler: async (request, h) =>
        {
            const authenticatedUser = request.auth.credentials.user as User;

            const publisher = await Publisher.retrieve(request.params.id);

            if (!publisher.isOwnedByUser(authenticatedUser))
            {
                throw Boom.forbidden();
            }

            return {
                dns: {
                    record: `${Config.DOMAIN_VERIFICATION_DNS_TXT_RECORD_PREFIX}=${publisher.dns_txt_value}`,
                },
            };
        },
    },
    {
        method: "GET",
        path: "/bundles/{id}/publishers",
        options: {
            validate: {
                params: Joi.object({
                    id: ID_SCHEMA(Config.ID_PREFIXES.BUNDLE).required(),
                }),
            },
            response: {
                schema: Joi.array().items(PUBLISHER_SCHEMA).required(),
            },
        },
        handler: async (request, h) =>
        {
            const authenticatedUser = request.auth.credentials.user as User;

            const bundle = await Bundle.retrieve(request.params.id);

            const publishers = await Publisher.forBundle(bundle);

            return publishers.map(publisher => publisher.serialize({ for: authenticatedUser }));
        },
    },
    {
        method: "GET",
        path: "/organizations/{id}/publishers",
        options: {
            validate: {
                params: Joi.object({
                    id: ID_SCHEMA(Config.ID_PREFIXES.ORGANIZATION).required(),
                }),
                query: Joi.object({
                    not_in_bundle: ID_SCHEMA(Config.ID_PREFIXES.BUNDLE),
                }),
            },
            response: {
                schema: Joi.array().items(PUBLISHER_SCHEMA).required(),
            },
        },
        handler: async (request, h) =>
        {
            const organization = await Organization.retrieve(request.params.id);

            const authenticatedUser = request.auth.credentials.user as User;

            if (organization.owner.id !== authenticatedUser.id)
            {
                throw Boom.forbidden();
            }

            const publishers = await Publisher.forOrganization(organization, {
                not_in_bundle: request.query.not_in_bundle,
            });

            return publishers.map(publisher => publisher.serialize({ for: authenticatedUser }));
        },
    },
    {
        method: [ "POST", "DELETE" ],
        path: "/bundles/{bundle_id}/publishers/{publisher_id}",
        options: {
            validate: {
                params: Joi.object({
                    bundle_id: ID_SCHEMA(Config.ID_PREFIXES.BUNDLE).required(),
                    publisher_id: ID_SCHEMA(Config.ID_PREFIXES.PUBLISHER).required(),
                }),
            },
        },
        handler: async (request, h) =>
        {
            const bundle = await Bundle.retrieve(request.params.bundle_id, [ "organization" ]);

            if (!(bundle.organization instanceof Organization))
            {
                throw Boom.badImplementation();
            }

            const authenticatedUser = request.auth.credentials.user as User;

            if (bundle.organization.owner.id !== authenticatedUser.id)
            {
                throw Boom.forbidden();
            }

            const publisher = await Publisher.retrieve(request.params.publisher_id);

            if (!publisher.isOwnedByUser(authenticatedUser))
            {
                throw Boom.badImplementation();
            }

            switch (request.method)
            {
                case "delete":
                {
                    await bundle.removePublisher(publisher);

                    break;
                }
                case "post":
                {
                    await bundle.addPublisher(publisher);

                    break;
                }
            }

            return h.response();
        },
    },
    {
        method: "POST",
        path: "/organizations/{id}/publishers",
        options: {
            validate: {
                payload: PUBLISHER_CREATE_SCHEMA,
            },
            response: {
                schema: PUBLISHER_SCHEMA,
            },
        },
        handler: async (request, h) =>
        {
            const organization = await Organization.retrieve(request.params.id);

            const authenticatedUser = request.auth.credentials.user as User;

            if (organization.owner.id !== authenticatedUser.id)
            {
                throw Boom.forbidden();
            }

            const publisher = await Publisher.create(request.payload as any, organization);

            return publisher.serialize({ for: authenticatedUser });
        },
    },
    {
        method: "POST",
        path: "/publishers/{id}/verify",
        handler: async (request, h) =>
        {
            const authenticatedUser = request.auth.credentials.user as User;

            const publisher = await Publisher.retrieve(request.params.id);

            if (!publisher.isOwnedByUser(authenticatedUser))
            {
                throw Boom.forbidden();
            }

            const result = await dns
                .resolveTxt(new URL(publisher.url).hostname)
                .catch(() =>
                {
                    throw Boom.badImplementation();
                });

            const domainVerificationId = result
                .find(record => record[0].startsWith(Config.DOMAIN_VERIFICATION_DNS_TXT_RECORD_PREFIX))
                ?.[0].split("=")[1];

            if (!domainVerificationId)
            {
                throw Boom.badRequest(undefined, [
                    {
                        field: "url",
                        error: `Could not verify domain '${publisher.url}'`,
                    },
                ]);
            }

            if (domainVerificationId !== publisher.dns_txt_value)
            {
                throw Boom.badRequest(undefined, [
                    {
                        field: "publisher",
                        error: `TXT Record for '${publisher.url}' does not match the expected value`,
                    },
                ]);
            }

            await Database.pool
                .query(
                    `update "publishers" set "verified" = $1 where "id" = $2`,
                    [ true, publisher.id ],
                )
                .catch(() =>
                {
                    throw Boom.badImplementation();
                });

            return h.response();
        },
    },
    {
        method: "PATCH",
        path: "/publishers/{id}",
        options: {
            validate: {
                params: Joi.object({
                    id: ID_SCHEMA(Config.ID_PREFIXES.PUBLISHER).required(),
                }),
                payload: PUBLISHER_UPDATE_SCHEMA,
            },
            response: {
                schema: PUBLISHER_SCHEMA,
            },
        },
        handler: async (request, h) =>
        {
            const publisher = await Publisher.retrieve(request.params.id);

            const authenticatedUser = request.auth.credentials.user as User;

            if (!publisher.isOwnedByUser(authenticatedUser))
            {
                throw Boom.forbidden();
            }

            await publisher.update(request.payload as any);

            return publisher.serialize({ for: authenticatedUser });
        },
    },
    {
        method: "PUT",
        path: "/publishers/{id}/image",
        options: {
            payload: {
                allow: "multipart/form-data",
                multipart: true,
                maxBytes: Config.PUBLISHER_IMAGE_MAX_SIZE,
            },
            validate: {
                params: Joi.object({
                    id: ID_SCHEMA(Config.ID_PREFIXES.PUBLISHER).required(),
                }),
                payload: Joi.object({
                    image: Joi.binary().required(),
                }),
            },
        },
        handler: async (request, h) =>
        {
            const publisher = await Publisher.retrieve(request.params.id);

            const authenticatedUser = request.auth.credentials.user as User;

            if (!publisher.isOwnedByUser(authenticatedUser))
            {
                throw Boom.forbidden();
            }

            const { image } = request.payload as any;

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

            const client = await Database.pool.connect();

            await client.query("begin");

            await client
                .query(
                    `update "publishers" set "has_image" = $1 where "id" = $2`,
                    [ true, publisher.id ],
                )
                .catch(async () =>
                {
                    await client.query("rollback");

                    throw Boom.badImplementation();
                });

            const s3Client = new AWS.S3({
                credentials: Config.AWS_CREDENTIALS,
                endpoint: Config.AWS_ENDPOINT,
                s3ForcePathStyle: true,
            });

            await s3Client.upload({
                Bucket: process.env.AWS_PUBLISHER_ICONS_BUCKET_NAME ?? "",
                Key: publisher.id,
                Body: image,
            })
            .promise()
            .catch(async () =>
            {
                await client.query("rollback");

                throw Boom.badImplementation();
            });

            await client.query("commit");

            return h.response();
        },
    },
    {
        method: "DELETE",
        path: "/publishers/{id}",
        options: {
            validate: {
                params: Joi.object({
                    id: ID_SCHEMA(Config.ID_PREFIXES.PUBLISHER).required(),
                }),
            },
        },
        handler: async (request, h) =>
        {
            const publisher = await Publisher.retrieve(request.params.id);

            const authenticatedUser = request.auth.credentials.user as User;

            if (!publisher.isOwnedByUser(authenticatedUser))
            {
                throw Boom.forbidden();
            }

            await publisher.delete();

            return h.response();
        },
    },
];
