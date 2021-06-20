import Boom from "@hapi/boom";
import { ServerRoute } from "@hapi/hapi";
import Joi from "joi";
import { Config } from "../../config/Config";
import { Schema } from "../../config/Schema";
import { Article } from "../../models/Article";
import { Author } from "../../models/Author";
import { Publisher } from "../../models/Publisher";
import { Session } from "../../models/Session";
import { ARTICLE_SCHEMA } from "../../types/article";
import Database from "../../utilities/Database";

export default <ServerRoute[]>[
    {
        method: "GET",
        path: "/articles/trending",
        options: {
            validate: {
                query: Joi.object({
                    expand: Schema.EXPAND_QUERY,
                }),
            },
            response: {
                schema: Schema.ARRAY(ARTICLE_SCHEMA.OBJ).max(Config.TRENDING_ARTICLES_MAX_LENGTH),
            },
        },
        handler: async (request, h) =>
        {
            const authenticatedUser = (request.auth.credentials.session as Session).user;

            const articles = await Article.trending(request.query.expand);

            return Promise.all(articles.map(_ => _.serialize({ for: authenticatedUser })));
        },
    },
    {
        method: "GET",
        path: "/articles/{id}",
        options: {
            validate: {
                params: Joi.object({
                    id: Schema.ID.ARTICLE.required(),
                }),
                query: Joi.object({
                    expand: Schema.EXPAND_QUERY,
                }),
            },
            response: {
                schema: ARTICLE_SCHEMA.OBJ,
            },
        },
        handler: async (request, h) =>
        {
            const authenticatedUser = (request.auth.credentials.session as Session).user;

            const article = await Article.retrieve(request.params.id, request.query.expand);

            const author = await Author.retrieve(article.author.id, [ "publisher" ]);

            if (!(author.publisher instanceof Publisher))
            {
                throw Boom.badImplementation();
            }

            if (!await authenticatedUser.isSubscribedToPublisher(author.publisher))
            {
                return h
                    .response(article.serialize({ for: authenticatedUser })) // Only the metadata (content is excluded by default)
                    .code(402); // Payment Required
            }

            // TODO:
            // Increment article view_count

            const { rowCount } = await Database.pool
                .query(
                    `
                    select 1
                    from "user_history"
                    where
                        "user" = $1
                        and
                        "article" = $2
                    limit 1
                    `,
                    [
                        authenticatedUser.id,
                        article.id,
                    ],
                );

            const query = rowCount === 0
                ? `insert into "user_history" ("user", "article", "last_viewed_at") values ($1, $2, $3)`
                : `update "user_history" set "last_viewed_at" = $3 where "user" = $1 and "article" = $2`;

            await Database.pool
                .query(
                    query,
                    [
                        authenticatedUser.id,
                        article.id,
                        new Date().toISOString(),
                    ],
                ).catch(e =>
                {
                    console.log(e)
                });

            return article.serialize({
                for: authenticatedUser,
                includeContent: true,
                includeMetadata: true,
            });
        },
    },
    {
        method: "GET",
        path: "/publishers/{id}/articles",
        options: {
            validate: {
                params: Joi.object({
                    id: Schema.ID.PUBLISHER.required(),
                }),
                query: Joi.object({
                    expand: Schema.EXPAND_QUERY,
                }),
            },
            response: {
                schema: Schema.ARRAY(ARTICLE_SCHEMA.OBJ).required(),
            },
        },
        handler: async (request, h) =>
        {
            const authenticatedUser = (request.auth.credentials.session as Session).user;

            const publisher = await Publisher.retrieve(request.params.id);

            if (!await authenticatedUser.isSubscribedToPublisher(publisher))
            {
                throw Boom.paymentRequired();
            }

            const articles = await Article.forPublisher(publisher, request.query.expand);

            return Promise.all(articles.map(_ => _.serialize({ for: authenticatedUser })));
        },
    },
    {
        method: "GET",
        path: "/users/{id}/articles/recent",
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
                schema: Schema.ARRAY(ARTICLE_SCHEMA.OBJ).max(Config.RECENT_ARTICLES_MAX_LENGTH),
            },
        },
        handler: async (request, h) =>
        {
            const authenticatedUser = (request.auth.credentials.session as Session).user;

            if (authenticatedUser.id !== request.params.id)
            {
                throw Boom.forbidden();
            }

            const articles = await Article.retrieveRecent(authenticatedUser, request.query.expand);

            return Promise.all(articles.map(_ => _.serialize({ for: authenticatedUser })));
        },
    },
    {
        method: "POST",
        path: "/authors/{id}/articles",
        options: {
            validate: {
                params: Joi.object({
                    id: Schema.ID.AUTHOR.required(),
                }),
                query: Joi.object({
                    expand: Schema.EXPAND_QUERY,
                }),
                payload: ARTICLE_SCHEMA.CREATE,
            },
            response: {
                schema: ARTICLE_SCHEMA.OBJ,
            },
        },
        handler: async (request, h) =>
        {
            const authenticatedUser = (request.auth.credentials.session as Session).user;

            const author = await Author.retrieve(request.params.id, [ "publisher" ]);

            if (!(author.publisher instanceof Publisher))
            {
                throw Boom.badImplementation();
            }

            if (author.user.id !== authenticatedUser.id)
            {
                throw Boom.forbidden();
            }

            if (!author.publisher.verified)
            {
                throw Boom.forbidden(undefined, [
                    {
                        field: "author",
                        error: `Cannot add articles to unverified publisher '${author.publisher.id}'`,
                    },
                ]);
            }

            const article = await Article.create(
                request.payload as any,
                author,
                request.query.expand,
            );

            return article.serialize({ for: authenticatedUser });
        },
    },
    {
        method: "PATCH",
        path: "/articles/{id}",
        options: {
            validate: {
                params: Joi.object({
                    id: Schema.ID.ARTICLE.required(),
                }),
                query: Joi.object({
                    expand: Schema.EXPAND_QUERY,
                }),
                payload: ARTICLE_SCHEMA.UPDATE,
            },
            response: {
                schema: ARTICLE_SCHEMA.OBJ,
            },
        },
        handler: async (request, h) =>
        {
            const authenticatedUser = (request.auth.credentials.session as Session).user;

            const article = await Article.retrieve(request.params.id, request.query.expand);

            const author = await Author.retrieve(article.author.id);

            if (author.user.id !== authenticatedUser.id)
            {
                throw Boom.forbidden();
            }

            await article.update(request.payload as any);

            return article.serialize({ includeContent: true });
        },
    },
    {
        method: "DELETE",
        path: "/articles/{id}",
        options: {
            validate: {
                params: Joi.object({
                    id: Schema.ID.ARTICLE.required(),
                }),
            },
        },
        handler: async (request, h) =>
        {
            const article = await Article.retrieve(request.params.id, [ "author" ]);

            if (!(article.author instanceof Author))
            {
                throw Boom.badImplementation();
            }

            const authenticatedUser = (request.auth.credentials.session as Session).user;

            if (article.author.user.id !== authenticatedUser.id)
            {
                throw Boom.forbidden();
            }

            await article.delete();

            return h.response();
        },
    },
];
