import Boom from "@hapi/boom";
import { ServerRoute } from "@hapi/hapi";
import Joi from "joi";
import { Config } from "../../config/Config";
import { Schema } from "../../config/Schema";
import { Article } from "../../models/Article";
import { Author } from "../../models/Author";
import { Publisher } from "../../models/Publisher";
import { Source } from "../../models/Source";
import { ARTICLE_SCHEMA } from "../../types/article";
import { SOURCE_SCHEMA } from "../../types/source";
import Database from "../../utilities/Database";
import Utilities from "../../utilities/Utilities";

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
            const [ authenticatedUser ] = Utilities.getAuthenticatedUser(request);

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
            const [ authenticatedUser ] = Utilities.getAuthenticatedUser(request);

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
                );

            return article.serialize({
                for: authenticatedUser,
                includeContent: true,
                includeMetadata: true,
            });
        },
    },
    {
        method: "GET",
        path: "/articles/{id}/sources",
        options: {
            validate: {
                params: Joi.object({
                    id: Schema.ID.ARTICLE.required(),
                }),
            },
            response: {
                schema: Schema.ARRAY(SOURCE_SCHEMA.OBJ),
            },
        },
        handler: async (request, h) =>
        {
            const [ authenticatedUser ] = Utilities.getAuthenticatedUser(request);

            const article = await Article.retrieve(request.params.id, request.query.expand);

            const author = await Author.retrieve(article.author.id, [ "publisher" ]);

            if (!(author.publisher instanceof Publisher))
            {
                throw Boom.badImplementation();
            }

            if (!await authenticatedUser.isSubscribedToPublisher(author.publisher))
            {
                throw Boom.paymentRequired();
            }

            const sources = await Source.forArticle(article);

            return sources.map(_ => _.serialize());
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
            const [ authenticatedUser ] = Utilities.getAuthenticatedUser(request);

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

            const [ authenticatedUser ] = Utilities.getAuthenticatedUser(request);

            if (article.author.user.id !== authenticatedUser.id)
            {
                throw Boom.forbidden();
            }

            await article.delete();

            return h.response();
        },
    },
];
