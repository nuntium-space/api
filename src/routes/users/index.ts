import Boom from "@hapi/boom";
import { ServerRoute } from "@hapi/hapi";
import Joi from "joi";
import { Config } from "../../config/Config";
import { ID_SCHEMA, URL_SCHEMA, USER_CREATE_SCHEMA, USER_SCHEMA, USER_UPDATE_SCHEMA } from "../../config/schemas";
import { User } from "../../models/User";

export default <ServerRoute[]>[
    {
        method: "GET",
        path: "/users/{id}",
        options: {
            validate: {
                params: Joi.object({
                    id: ID_SCHEMA(Config.ID_PREFIXES.USER).required(),
                }),
            },
            response: {
                schema: USER_SCHEMA,
            },
        },
        handler: async (request, h) =>
        {
            const authenticatedUser = request.auth.credentials.user as User;

            if (request.params.id !== authenticatedUser.id)
            {
                throw Boom.forbidden();
            }

            return authenticatedUser.serialize();
        },
    },
    {
        method: "GET",
        path: "/users/{id}/stripe/portal",
        options: {
            validate: {
                params: Joi.object({
                    id: ID_SCHEMA(Config.ID_PREFIXES.USER).required(),
                }),
            },
            response: {
                schema: Joi.object({
                    url: URL_SCHEMA.required(),
                }),
            },
        },
        handler: async (request, h) =>
        {
            const authenticatedUser = request.auth.credentials.user as User;

            if (request.params.id !== authenticatedUser.id)
            {
                throw Boom.forbidden();
            }

            if (!authenticatedUser.stripe_customer_id)
            {
                throw Boom.badImplementation();
            }

            const { url } = await Config.STRIPE.billingPortal
                .sessions
                .create({
                    customer: authenticatedUser.stripe_customer_id,
                })
                .catch(() =>
                {
                    throw Boom.badImplementation();
                });

            return { url };
        },
    },
    {
        method: "POST",
        path: "/users",
        options: {
            auth: false,
            validate: {
                payload: USER_CREATE_SCHEMA,
            },
            response: {
                schema: USER_SCHEMA,
            },
        },
        handler: async (request, h) =>
        {
            const user = await User.create(request.payload as any);

            return user.serialize();
        },
    },
    {
        method: "PATCH",
        path: "/users/{id}",
        options: {
            validate: {
                params: Joi.object({
                    id: ID_SCHEMA(Config.ID_PREFIXES.USER).required(),
                }),
                payload: USER_UPDATE_SCHEMA,
            },
            response: {
                schema: USER_SCHEMA,
            },
        },
        handler: async (request, h) =>
        {
            const user = await User.retrieve(request.params.id);

            const authenticatedUser = request.auth.credentials.user as User;

            if (user.id !== authenticatedUser.id)
            {
                throw Boom.forbidden();
            }

            await user.update(request.payload as any);

            return user.serialize();
        },
    },
    {
        method: "DELETE",
        path: "/users/{id}",
        options: {
            validate: {
                params: Joi.object({
                    id: ID_SCHEMA(Config.ID_PREFIXES.USER).required(),
                }),
            },
        },
        handler: async (request, h) =>
        {
            const user = await User.retrieve(request.params.id);

            const authenticatedUser = request.auth.credentials.user as User;

            if (user.id !== authenticatedUser.id)
            {
                throw Boom.forbidden();
            }

            await user.delete();

            return h.response();
        },
    },
];