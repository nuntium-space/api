import Boom from "@hapi/boom";
import { ServerRoute } from "@hapi/hapi";
import Joi from "joi";
import { Config } from "../../config/Config";
import { COMMENT_CREATE_SCHEMA, COMMENT_SCHEMA, COMMENT_UPDATE_SCHEMA, EXPAND_QUERY_SCHEMA, ID_SCHEMA } from "../../config/schemas";
import { Article } from "../../models/Article";
import { Comment } from "../../models/Comment";
import { Session } from "../../models/Session";

export default <ServerRoute[]>[
    {
        method: "GET",
        path: "/comments/{id}",
        options: {
            validate: {
                params: Joi.object({
                    id: ID_SCHEMA(Config.ID_PREFIXES.COMMENT).required(),
                }),
                query: Joi.object({
                    expand: EXPAND_QUERY_SCHEMA,
                }),
            },
            response: {
                schema: COMMENT_SCHEMA,
            },
        },
        handler: async (request, h) =>
        {
            const authenticatedUser = (request.auth.credentials.session as Session).user;

            const comment = await Comment.retrieve(request.params.id, request.query.expand);

            return comment.serialize({ for: authenticatedUser });
        },
    },
    {
        method: "GET",
        path: "/articles/{id}/comments",
        options: {
            validate: {
                params: Joi.object({
                    id: ID_SCHEMA(Config.ID_PREFIXES.ARTICLE).required(),
                }),
                query: Joi.object({
                    parent: ID_SCHEMA(Config.ID_PREFIXES.COMMENT),
                    expand: EXPAND_QUERY_SCHEMA,
                }),
            },
            response: {
                schema: Joi.array().items(COMMENT_SCHEMA).required(),
            },
        },
        handler: async (request, h) =>
        {
            const authenticatedUser = (request.auth.credentials.session as Session).user;

            const article = await Article.retrieve(request.params.id);

            const comments = await Comment.forArticle(article, {
                parent: request.query.parent ?? null,
                expand: request.query.expand,
            });

            return comments.map(comment => comment.serialize({ for: authenticatedUser }));
        },
    },
    {
        method: "POST",
        path: "/articles/{id}/comments",
        options: {
            validate: {
                params: Joi.object({
                    id: ID_SCHEMA(Config.ID_PREFIXES.ARTICLE).required(),
                }),
                query: Joi.object({
                    expand: EXPAND_QUERY_SCHEMA,
                }),
                payload: COMMENT_CREATE_SCHEMA,
            },
            response: {
                schema: COMMENT_SCHEMA,
            },
        },
        handler: async (request, h) =>
        {
            const authenticatedUser = (request.auth.credentials.session as Session).user;

            const comment = await Comment.create(
                {
                    ...request.payload as any,
                    article: request.params.id,
                    user: authenticatedUser.id,
                },
                request.query.expand,
            );

            return comment.serialize({ for: authenticatedUser });
        },
    },
    {
        method: "PATCH",
        path: "/comments/{id}",
        options: {
            validate: {
                params: Joi.object({
                    id: ID_SCHEMA(Config.ID_PREFIXES.COMMENT).required(),
                }),
                payload: COMMENT_UPDATE_SCHEMA,
            },
            response: {
                schema: COMMENT_SCHEMA,
            },
        },
        handler: async (request, h) =>
        {
            const comment = await Comment.retrieve(request.params.id);

            const authenticatedUser = (request.auth.credentials.session as Session).user;

            if (comment.user.id !== authenticatedUser.id)
            {
                throw Boom.forbidden();
            }

            await comment.update(request.payload as any);

            return comment.serialize({ for: authenticatedUser });
        },
    },
    {
        method: "DELETE",
        path: "/comments/{id}",
        options: {
            validate: {
                params: Joi.object({
                    id: ID_SCHEMA(Config.ID_PREFIXES.COMMENT).required(),
                }),
            },
        },
        handler: async (request, h) =>
        {
            const comment = await Comment.retrieve(request.params.id);

            const authenticatedUser = (request.auth.credentials.session as Session).user;

            if (comment.user.id !== authenticatedUser.id)
            {
                throw Boom.forbidden();
            }

            await comment.delete();

            return h.response();
        },
    },
];
