import Boom from "@hapi/boom";
import { ServerRoute } from "@hapi/hapi";
import Joi from "joi";
import { Config } from "../../config/Config";
import { EXPAND_QUERY_SCHEMA, ID_SCHEMA, PRICE_CREATE_SCHEMA, PRICE_SCHEMA } from "../../config/schemas";
import { Bundle } from "../../models/Bundle";
import { Organization } from "../../models/Organization";
import { Price } from "../../models/Price";
import { Session } from "../../models/Session";

export default <ServerRoute[]>[
    {
        method: "GET",
        path: "/prices/{id}",
        options: {
            validate: {
                params: Joi.object({
                    id: ID_SCHEMA(Config.ID_PREFIXES.PRICE).required(),
                }),
                query: Joi.object({
                    expand: EXPAND_QUERY_SCHEMA,
                }),
            },
            response: {
                schema: PRICE_SCHEMA,
            },
        },
        handler: async (request, h) =>
        {
            const authenticatedUser = (request.auth.credentials.session as Session).user;

            const price = await Price.retrieve(request.params.id, request.query.expand);

            return price.serialize({ for: authenticatedUser });
        },
    },
    {
        method: "GET",
        path: "/bundles/{id}/prices",
        options: {
            validate: {
                params: Joi.object({
                    id: ID_SCHEMA(Config.ID_PREFIXES.BUNDLE).required(),
                }),
                query: Joi.object({
                    active: Joi.boolean(),
                    expand: EXPAND_QUERY_SCHEMA,
                }),
            },
            response: {
                schema: Joi.array().items(PRICE_SCHEMA).required(),
            },
        },
        handler: async (request, h) =>
        {
            const authenticatedUser = (request.auth.credentials.session as Session).user;

            const bundle = await Bundle.retrieve(request.params.id);

            const prices = await Price.forBundle(bundle, {
                active: request.query.active,
                expand: request.query.expand,
            });

            return prices.map(price => price.serialize({ for: authenticatedUser }));
        },
    },
    {
        method: "POST",
        path: "/bundles/{id}/prices",
        options: {
            validate: {
                params: Joi.object({
                    id: ID_SCHEMA(Config.ID_PREFIXES.BUNDLE).required(),
                }),
                query: Joi.object({
                    expand: EXPAND_QUERY_SCHEMA,
                }),
                payload: PRICE_CREATE_SCHEMA,
            },
            response: {
                schema: PRICE_SCHEMA,
            },
        },
        handler: async (request, h) =>
        {
            const authenticatedUser = (request.auth.credentials.session as Session).user;

            const bundle = await Bundle.retrieve(request.params.id, [ "organization" ]);

            if (!(bundle.organization instanceof Organization))
            {
                throw Boom.badImplementation();
            }

            if (bundle.organization.owner.id !== authenticatedUser.id)
            {
                throw Boom.forbidden();
            }

            const price = await Price.create(
                request.payload as any,
                bundle,
                request.query.expand,
            );

            return price.serialize({ for: authenticatedUser });
        },
    },
    {
        method: "DELETE",
        path: "/prices/{id}",
        options: {
            validate: {
                params: Joi.object({
                    id: ID_SCHEMA(Config.ID_PREFIXES.PRICE).required(),
                }),
            },
        },
        handler: async (request, h) =>
        {
            const authenticatedUser = (request.auth.credentials.session as Session).user;

            const price = await Price.retrieve(request.params.id, [ "bundle", "bundle.organization" ]);

            if
            (
                !(price.bundle instanceof Bundle)
                || !(price.bundle.organization instanceof Organization)
            )
            {
                throw Boom.badImplementation();
            }

            if (price.bundle.organization.owner.id !== authenticatedUser.id)
            {
                throw Boom.forbidden();
            }

            await price.delete();

            return h.response();
        },
    },
];
