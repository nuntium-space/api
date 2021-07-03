import Boom from "@hapi/boom";
import { ServerRoute } from "@hapi/hapi";
import Joi from "joi";
import { Schema } from "../../config/Schema";
import { Bundle } from "../../models/Bundle";
import { Organization } from "../../models/Organization";
import { Price } from "../../models/Price";
import { PRICE_SCHEMA } from "../../types/price";
import Utilities from "../../utilities/Utilities";

export default <ServerRoute[]>[
    {
        method: "GET",
        path: "/prices/{id}",
        options: {
            validate: {
                params: Joi.object({
                    id: Schema.ID.PRICE.required(),
                }),
                query: Joi.object({
                    expand: Schema.EXPAND_QUERY,
                }),
            },
            response: {
                schema: PRICE_SCHEMA.OBJ,
            },
        },
        handler: async (request, h) =>
        {
            const [ authenticatedUser ] = Utilities.getAuthenticatedUser(request);

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
                    id: Schema.ID.BUNDLE.required(),
                }),
                query: Joi.object({
                    active: Schema.BOOLEAN,
                    expand: Schema.EXPAND_QUERY,
                }),
            },
            response: {
                schema: Schema.ARRAY(PRICE_SCHEMA.OBJ).required(),
            },
        },
        handler: async (request, h) =>
        {
            const [ authenticatedUser ] = Utilities.getAuthenticatedUser(request);

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
                    id: Schema.ID.BUNDLE.required(),
                }),
                query: Joi.object({
                    expand: Schema.EXPAND_QUERY,
                }),
                payload: PRICE_SCHEMA.CREATE,
            },
            response: {
                schema: Schema.NOT_EXPANDED_RESOURCE(Schema.ID.PRICE),
            },
        },
        handler: async (request, h) =>
        {
            const [ authenticatedUser ] = Utilities.getAuthenticatedUser(request);

            const bundle = await Bundle.retrieve(request.params.id, [ "organization" ]);

            if (!(bundle.organization instanceof Organization))
            {
                throw Boom.badImplementation();
            }

            if (bundle.organization.owner.id !== authenticatedUser.id)
            {
                throw Boom.forbidden();
            }

            return Price.create(request.payload as any, bundle);
        },
    },
    {
        method: "PATCH",
        path: "/prices/{id}",
        options: {
            validate: {
                params: Joi.object({
                    id: Schema.ID.PRICE.required(),
                }),
                payload: PRICE_SCHEMA.UPDATE,
            },
            response: {
                schema: PRICE_SCHEMA.OBJ,
            },
        },
        handler: async (request, h) =>
        {
            const [ authenticatedUser ] = Utilities.getAuthenticatedUser(request);

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

            await price.update(request.payload as any);

            return price.serialize({ for: authenticatedUser });
        },
    },
];
