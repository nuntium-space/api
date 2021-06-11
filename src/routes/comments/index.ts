import Boom from "@hapi/boom";
import { ServerRoute } from "@hapi/hapi";
import Joi from "joi";
import { Schema } from "../../config/Schema";
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
                    id: Schema.ID.COMMENT.required(),
                }),
                query: Joi.object({
                    expand: Schema.EXPAND_QUERY,
                }),
            },
            response: {
                schema: Comment.SCHEMA.OBJ,
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
                    id: Schema.ID.ARTICLE.required(),
                }),
                query: Joi.object({
                    parent: Schema.ID.COMMENT,
                    expand: Schema.EXPAND_QUERY,
                }),
            },
            response: {
                schema: Schema.ARRAY(Comment.SCHEMA.OBJ).required(),
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
                    id: Schema.ID.ARTICLE.required(),
                }),
                query: Joi.object({
                    expand: Schema.EXPAND_QUERY,
                }),
                payload: Comment.SCHEMA.CREATE,
            },
            response: {
                schema: Comment.SCHEMA.OBJ,
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
                    id: Schema.ID.COMMENT.required(),
                }),
                payload: Comment.SCHEMA.UPDATE,
            },
            response: {
                schema: Comment.SCHEMA.OBJ,
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
                    id: Schema.ID.COMMENT.required(),
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
