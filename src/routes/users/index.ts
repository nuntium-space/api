import Boom from "@hapi/boom";
import { ServerRoute } from "@hapi/hapi";
import Joi from "joi";
import { Config } from "../../config/Config";
import { Schema } from "../../config/Schema";
import { Article } from "../../models/Article";
import { Session } from "../../models/Session";
import { User } from "../../models/User";
import Database from "../../utilities/Database";

export default <ServerRoute[]>[
    {
        method: "GET",
        path: "/users/{id}",
        options: {
            validate: {
                params: Joi.object({
                    id: Schema.ID.USER.required(),
                }),
            },
            response: {
                schema: User.SCHEMA.OBJ,
            },
        },
        handler: async (request, h) =>
        {
            const authenticatedUser = (request.auth.credentials.session as Session).user;

            if (request.params.id !== authenticatedUser.id)
            {
                throw Boom.forbidden();
            }

            return authenticatedUser.serialize({ for: authenticatedUser });
        },
    },
    {
        method: "GET",
        path: "/users/{id}/history",
        options: {
            validate: {
                params: Joi.object({
                    id: Schema.ID.USER.required(),
                }),
            },
            response: {
                schema: Schema.ARRAY(
                    Joi.object({
                        article: Article.SCHEMA.OBJ.required(),
                        timestamp: Schema.DATETIME.required(),
                    }),
                ),
            },
        },
        handler: async (request, h) =>
        {
            const authenticatedUser = (request.auth.credentials.session as Session).user;

            if (request.params.id !== authenticatedUser.id)
            {
                throw Boom.forbidden();
            }

            const result = await Database.pool
                .query(
                    `
                    select "article", "timestamp"
                    from "user_history"
                    where "user" = $1
                    `,
                    [ authenticatedUser.id ],
                );

            return Promise.all(
                result.rows.map(async _ =>
                {
                    const article = await Article.retrieve(_.article);
        
                    return {
                        article: article.serialize(),
                        timestamp: _.timestamp,
                    };
                }),
            );
        },
    },
    {
        method: "GET",
        path: "/users/{id}/settings",
        options: {
            validate: {
                params: Joi.object({
                    id: Schema.ID.USER.required(),
                }),
            },
            response: {
                schema: Joi.object({
                    language: Schema.NULLABLE(Schema.LANGUAGE).required(),
                }),
            },
        },
        handler: async (request, h) =>
        {
            const authenticatedUser = (request.auth.credentials.session as Session).user;

            if (request.params.id !== authenticatedUser.id)
            {
                throw Boom.forbidden();
            }

            return authenticatedUser.retrieveSettings();
        },
    },
    {
        method: "GET",
        path: "/users/{id}/stripe/portal",
        options: {
            validate: {
                params: Joi.object({
                    id: Schema.ID.USER.required(),
                }),
            },
            response: {
                schema: Joi.object({
                    url: Schema.URL.required(),
                }),
            },
        },
        handler: async (request, h) =>
        {
            const authenticatedUser = (request.auth.credentials.session as Session).user;

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
        method: "PATCH",
        path: "/users/{id}",
        options: {
            validate: {
                params: Joi.object({
                    id: Schema.ID.USER.required(),
                }),
                payload: User.SCHEMA.UPDATE,
            },
            response: {
                schema: User.SCHEMA.OBJ,
            },
        },
        handler: async (request, h) =>
        {
            const user = await User.retrieve(request.params.id);

            const authenticatedUser = (request.auth.credentials.session as Session).user;

            if (user.id !== authenticatedUser.id)
            {
                throw Boom.forbidden();
            }

            await user.update(request.payload as any);

            return user.serialize({ for: authenticatedUser });
        },
    },
    {
        method: "PATCH",
        path: "/users/{id}/settings",
        options: {
            validate: {
                params: Joi.object({
                    id: Schema.ID.USER.required(),
                }),
                payload: Joi.object({
                    language: Schema.LANGUAGE,
                }),
            },
        },
        handler: async (request, h) =>
        {
            const authenticatedUser = (request.auth.credentials.session as Session).user;

            if (request.params.id !== authenticatedUser.id)
            {
                throw Boom.forbidden();
            }

            await authenticatedUser.updateSettings(request.payload as any);

            return h.response();
        },
    },
    {
        method: "DELETE",
        path: "/users/{id}",
        options: {
            validate: {
                params: Joi.object({
                    id: Schema.ID.USER.required(),
                }),
            },
        },
        handler: async (request, h) =>
        {
            const user = await User.retrieve(request.params.id);

            const authenticatedUser = (request.auth.credentials.session as Session).user;

            if (user.id !== authenticatedUser.id)
            {
                throw Boom.forbidden();
            }

            await user.delete();

            return h.response();
        },
    },
    {
        method: "GET",
        path: "/users/{id}/history",
        options: {
            validate: {
                params: Joi.object({
                    id: Schema.ID.USER.required(),
                }),
            },
        },
        handler: async (request, h) =>
        {
            const authenticatedUser = (request.auth.credentials.session as Session).user;

            if (request.params.id !== authenticatedUser.id)
            {
                throw Boom.forbidden();
            }

            await Database.pool
                .query(
                    `
                    delete from "user_history"
                    where "user" = $1
                    `,
                    [ authenticatedUser.id ],
                );

            return h.response();
        },
    },
];
