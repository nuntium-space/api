import Boom from "@hapi/boom";
import { ServerRoute } from "@hapi/hapi";
import Joi from "joi";
import { Config } from "../../config/Config";
import { ID_SCHEMA, PUBLISHER_CREATE_SCHEMA, PUBLISHER_SCHEMA, PUBLISHER_UPDATE_SCHEMA } from "../../config/schemas";
import { Bundle } from "../../models/Bundle";
import { Organization } from "../../models/Organization";
import { Publisher } from "../../models/Publisher";
import { User } from "../../models/User";

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
            const publisher = await Publisher.retrieve(request.params.id);

            return publisher.serialize();
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
            const bundle = await Bundle.retrieve(request.params.id);

            const publishers = await Publisher.forBundle(bundle);

            return publishers.map(publisher => publisher.serialize());
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

            return publishers.map(publisher => publisher.serialize());
        },
    },
    {
        method: "POST",
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

            await bundle.addPublisher(publisher);

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

            return publisher.serialize();
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

            return publisher.serialize();
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
