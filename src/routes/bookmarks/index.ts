import Boom from "@hapi/boom";
import { ServerRoute } from "@hapi/hapi";
import Joi from "joi";
import { Schema } from "../../config/Schema";
import { Article } from "../../models/Article";
import { Bookmark } from "../../models/Bookmark";
import { Session } from "../../models/Session";
import { BOOKMARK_SCHEMA } from "../../types/bookmark";

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
                schema: Schema.ARRAY(BOOKMARK_SCHEMA.OBJ),
            },
        },
        handler: async (request, h) =>
        {
            const authenticatedUser = (request.auth.credentials.session as Session).user;

            if (request.params.id !== authenticatedUser.id)
            {
                throw Boom.forbidden();
            }

            const bookmarks = await Bookmark.forUser(authenticatedUser);

            return Promise.all(bookmarks.map(_ => _.serialize()));
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
                payload: BOOKMARK_SCHEMA.CREATE,
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

            await Bookmark.create(authenticatedUser, article);

            return h.response();
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

            const bookmark = await Bookmark.retrieveWithUserAndArticle(authenticatedUser, (request.payload as any).article);

            await bookmark.delete();

            return h.response();
        },
    },
];
