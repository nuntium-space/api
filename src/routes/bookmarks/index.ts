import Boom from "@hapi/boom";
import { ServerRoute } from "@hapi/hapi";
import Joi from "joi";
import { Schema } from "../../config/Schema";
import { Article } from "../../models/Article";
import { Session } from "../../models/Session";
import Database from "../../utilities/Database";

export default <ServerRoute[]>[
    {
        method: "GET",
        path: "/users/{id}/bookmarks",
        options: {
            validate: {
                params: Joi.object({
                    id: Schema.ID.USER.required(),
                }),
                query: Joi.object({
                    expand: Schema.EXPAND_QUERY,
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
                    from "bookmarks"
                    where "user" = $1
                    `,
                    [
                        authenticatedUser.id,
                    ],
                )
                .catch(() =>
                {
                    throw Boom.badImplementation();
                });

            return Promise.all(result.rows.map(async _ =>
            {
                return {
                    article: (await Article.retrieve(_.article)).serialize(),
                    timestamp: _.timestamp,
                };
            }));
        },
    },
    {
        method: "POST",
        path: "/users/{id}/bookmarks",
        options: {
            validate: {
                params: Joi.object({
                    id: Schema.ID.USER.required(),
                }),
                query: Joi.object({
                    expand: Schema.EXPAND_QUERY,
                }),
                payload: Joi.object({
                    article: Schema.ID.ARTICLE.required(),
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

            const article = await Article.retrieve((request.payload as any).article);

            await Database.pool
                .query(
                    `
                    insert into "bookmarks"
                        ("user", "article")
                    values
                        ($1, $2)
                    `,
                    [
                        authenticatedUser.id,
                        article.id,
                    ],
                )
                .catch(() =>
                {
                    throw Boom.badImplementation();
                });

            return h.response().code(201); // Created
        },
    },
    {
        method: "DELETE",
        path: "/users/{id}/bookmarks",
        options: {
            validate: {
                params: Joi.object({
                    id: Schema.ID.USER.required(),
                }),
                query: Joi.object({
                    article: Schema.ID.ARTICLE.required(),
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

            const result = await Database.pool
                .query(
                    `
                    delete from "bookmarks"
                    where
                        "user" = $1
                        and
                        "article" = $2
                    `,
                    [
                        authenticatedUser.id,
                        request.query.article,
                    ],
                )
                .catch(() =>
                {
                    throw Boom.badImplementation();
                });

            if (result.rowCount === 0)
            {
                throw Boom.notFound();
            }

            return h.response();
        },
    },
];
