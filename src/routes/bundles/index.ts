import Boom from "@hapi/boom";
import { ServerRoute } from "@hapi/hapi";
import Joi from "joi";
import { Schema } from "../../config/Schema";
import { BUNDLE_CREATE_SCHEMA, BUNDLE_SCHEMA, BUNDLE_UPDATE_SCHEMA, EXPAND_QUERY_SCHEMA } from "../../config/schemas";
import { Bundle } from "../../models/Bundle";
import { Organization } from "../../models/Organization";
import { Publisher } from "../../models/Publisher";
import { Session } from "../../models/Session";

export default <ServerRoute[]>[
    {
        method: "GET",
        path: "/bundles/{id}",
        options: {
            validate: {
                params: Joi.object({
                    id: Schema.ID.BUNDLE.required(),
                }),
                query: Joi.object({
                    expand: EXPAND_QUERY_SCHEMA,
                }),
            },
            response: {
                schema: BUNDLE_SCHEMA,
            },
        },
        handler: async (request, h) =>
        {
            const authenticatedUser = (request.auth.credentials.session as Session).user;

            const bundle = await Bundle.retrieve(request.params.id, request.query.expand);

            return bundle.serialize({ for: authenticatedUser });
        },
    },
    {
        method: "GET",
        path: "/organizations/{id}/bundles",
        options: {
            validate: {
                params: Joi.object({
                    id: Schema.ID.ORGANIZATION.required(),
                }),
                query: Joi.object({
                    expand: EXPAND_QUERY_SCHEMA,
                }),
            },
            response: {
                schema: Schema.ARRAY(BUNDLE_SCHEMA).required(),
            },
        },
        handler: async (request, h) =>
        {
            const organization = await Organization.retrieve(request.params.id);

            const authenticatedUser = (request.auth.credentials.session as Session).user;

            if (organization.owner.id !== authenticatedUser.id)
            {
                throw Boom.forbidden();
            }

            const bundles = await Bundle.forOrganization(organization, request.query.expand);

            return bundles.map(bundle => bundle.serialize({ for: authenticatedUser }));
        },
    },
    {
        method: "GET",
        path: "/publishers/{id}/bundles",
        options: {
            validate: {
                params: Joi.object({
                    id: Schema.ID.PUBLISHER.required(),
                }),
                query: Joi.object({
                    expand: EXPAND_QUERY_SCHEMA,
                }),
            },
            response: {
                schema: Schema.ARRAY(BUNDLE_SCHEMA).required(),
            },
        },
        handler: async (request, h) =>
        {
            const authenticatedUser = (request.auth.credentials.session as Session).user;

            const publisher = await Publisher.retrieve(request.params.id);

            const bundles = await Bundle.forPublisher(publisher, request.query.expand);

            return bundles.map(bundle => bundle.serialize({ for: authenticatedUser }));
        },
    },
    {
        method: "POST",
        path: "/organizations/{id}/bundles",
        options: {
            validate: {
                params: Joi.object({
                    id: Schema.ID.ORGANIZATION.required(),
                }),
                query: Joi.object({
                    expand: EXPAND_QUERY_SCHEMA,
                }),
                payload: BUNDLE_CREATE_SCHEMA,
            },
            response: {
                schema: BUNDLE_SCHEMA,
            },
        },
        handler: async (request, h) =>
        {
            const organization = await Organization.retrieve(request.params.id);

            const authenticatedUser = (request.auth.credentials.session as Session).user;

            if (organization.owner.id !== authenticatedUser.id)
            {
                throw Boom.forbidden();
            }

            const bundle = await Bundle.create(
                request.payload as any,
                organization,
                request.query.expand,
            );

            return bundle.serialize({ for: authenticatedUser });
        },
    },
    {
        method: "PATCH",
        path: "/bundles/{id}",
        options: {
            validate: {
                params: Joi.object({
                    id: Schema.ID.BUNDLE.required(),
                }),
                payload: BUNDLE_UPDATE_SCHEMA,
            },
            response: {
                schema: BUNDLE_SCHEMA,
            },
        },
        handler: async (request, h) =>
        {
            const bundle = await Bundle.retrieve(request.params.id, [ "organization" ]);

            if (!(bundle.organization instanceof Organization))
            {
                throw Boom.badImplementation();
            }

            const authenticatedUser = (request.auth.credentials.session as Session).user;

            if (bundle.organization.owner.id !== authenticatedUser.id)
            {
                throw Boom.forbidden();
            }

            await bundle.update(request.payload as any);

            return bundle.serialize({ for: authenticatedUser });
        },
    },
    {
        method: "DELETE",
        path: "/bundles/{id}",
        options: {
            validate: {
                params: Joi.object({
                    id: Schema.ID.BUNDLE.required(),
                }),
            },
        },
        handler: async (request, h) =>
        {
            const bundle = await Bundle.retrieve(request.params.id, [ "organization" ]);

            if (!(bundle.organization instanceof Organization))
            {
                throw Boom.badImplementation();
            }

            const authenticatedUser = (request.auth.credentials.session as Session).user;

            if (bundle.organization.owner.id !== authenticatedUser.id)
            {
                throw Boom.forbidden();
            }

            await bundle.delete();

            return h.response();
        },
    },
];
