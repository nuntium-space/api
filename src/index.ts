import dotenv from "dotenv";

dotenv.config();

import Boom from "@hapi/boom";
import Hapi from "@hapi/hapi";
import Joi from "joi";
import qs from "qs";
import { Config } from "./config/Config";
import {
    ARTICLE_CREATE_SCHEMA,
    ARTICLE_SCHEMA,
    ARTICLE_UPDATE_SCHEMA,
    AUTHOR_CREATE_SCHEMA,
    AUTHOR_SCHEMA,
    BUNDLE_CREATE_SCHEMA,
    BUNDLE_SCHEMA,
    BUNDLE_UPDATE_SCHEMA,
    COMMENT_CREATE_SCHEMA,
    COMMENT_SCHEMA,
    COMMENT_UPDATE_SCHEMA,
    EXPAND_QUERY_SCHEMA,
    ID_SCHEMA,
    ORGANIZATION_CREATE_SCHEMA,
    ORGANIZATION_SCHEMA,
    ORGANIZATION_UPDATE_SCHEMA,
    PUBLISHER_CREATE_SCHEMA,
    PUBLISHER_SCHEMA,
    PUBLISHER_UPDATE_SCHEMA,
    SESSION_CREATE_SCHEMA,
    SESSION_SCHEMA,
    USER_CREATE_SCHEMA,
    USER_SCHEMA,
    USER_UPDATE_SCHEMA
} from "./config/schemas";
import { Article } from "./models/Article";
import { Author } from "./models/Author";
import { Bundle } from "./models/Bundle";
import { Comment } from "./models/Comment";
import { Organization } from "./models/Organization";
import { Publisher } from "./models/Publisher";
import { Session } from "./models/Session";
import { User } from "./models/User";
import Database from "./utilities/Database";
import Stripe from "stripe";

const server = Hapi.server({
    port: 4000,
    routes: {
        cors: true,
        validate: {
            options: {
                abortEarly: false,
            },
            failAction: async (request, h, error) =>
            {
                throw error;
            },
        },
        response: {
            emptyStatusCode: 204,
        },
    },
    query: {
        parser: qs.parse,
    },
});

const init = async () =>
{
    Database.init();

    server.auth.scheme("token", () =>
    {
        return {
            authenticate: async (request, h) =>
            {
                const authorization = request.raw.req.headers.authorization;

                if (!authorization)
                {
                    throw Boom.unauthorized();
                }

                const session = await Session.retrieve(authorization.split(" ")[1]);

                if (!session || session.hasExpired())
                {
                    throw Boom.unauthorized();
                }

                const { user } = session;

                return h.authenticated({ credentials: { user } });
            },
        };
    });

    server.auth.strategy("session", "token");

    server.auth.default({ strategy: "session" });

    server.ext("onPreResponse", (request, h) =>
    {
        const { response } = request;

        if (response instanceof Boom.Boom)
        {
            response.output.payload.message = response.message;
        }

        return h.continue;
    });

    server.route({
        method: "GET",
        path: "/articles/{id}",
        options: {
            validate: {
                params: Joi.object({
                    id: ID_SCHEMA(Config.ID_PREFIXES.ARTICLE).required(),
                }),
                query: Joi.object({
                    expand: EXPAND_QUERY_SCHEMA,
                }),
            },
            response: {
                schema: ARTICLE_SCHEMA,
            },
        },
        handler: async (request, h) =>
        {
            const article = await Article.retrieve(request.params.id, request.query.expand);

            if (!article)
            {
                throw Boom.notFound();
            }

            return article.serialize();
        }
    });

    server.route({
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
            const article = await Article.retrieve(request.params.id);

            if (!article)
            {
                throw Boom.notFound();
            }

            const comments = await Comment.forArticle(article, {
                parent: request.query.parent ?? null,
                expand: request.query.expand,
            });

            return comments.map(comment => comment.serialize());
        }
    });

    server.route({
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
            const authenticatedUser = request.auth.credentials.user as User;

            const comment = await Comment.create(
                {
                    ...request.payload as any,
                    article: request.params.id,
                    user: authenticatedUser.id,
                },
                request.query.expand,
            );

            return comment.serialize();
        }
    });

    server.route({
        method: "PATCH",
        path: "/articles/{id}",
        options: {
            validate: {
                params: Joi.object({
                    id: ID_SCHEMA(Config.ID_PREFIXES.ARTICLE).required(),
                }),
                payload: ARTICLE_UPDATE_SCHEMA,
            },
            response: {
                schema: ARTICLE_SCHEMA,
            },
        },
        handler: async (request, h) =>
        {
            const article = await Article.retrieve(request.params.id, [ "author" ]);

            if (!article)
            {
                throw Boom.notFound();
            }

            if (!(article.author instanceof Author))
            {
                throw Boom.badImplementation();
            }

            const authenticatedUser = request.auth.credentials.user as User;

            if (article.author.user.id !== authenticatedUser.id)
            {
                throw Boom.forbidden();
            }

            await article.update(request.payload as any);

            return article.serialize();
        }
    });

    server.route({
        method: "DELETE",
        path: "/articles/{id}",
        options: {
            validate: {
                params: Joi.object({
                    id: ID_SCHEMA(Config.ID_PREFIXES.ARTICLE).required(),
                }),
            },
        },
        handler: async (request, h) =>
        {
            const article = await Article.retrieve(request.params.id, [ "author" ]);

            if (!article)
            {
                throw Boom.notFound();
            }

            if (!(article.author instanceof Author))
            {
                throw Boom.badImplementation();
            }

            const authenticatedUser = request.auth.credentials.user as User;

            if (article.author.user.id !== authenticatedUser.id)
            {
                throw Boom.forbidden();
            }

            await article.delete();

            return h.response();
        }
    });

    server.route({
        method: "GET",
        path: "/authors/{id}",
        options: {
            validate: {
                params: Joi.object({
                    id: ID_SCHEMA(Config.ID_PREFIXES.AUTHOR).required(),
                }),
                query: Joi.object({
                    expand: EXPAND_QUERY_SCHEMA,
                }),
            },
            response: {
                schema: AUTHOR_SCHEMA,
            },
        },
        handler: async (request, h) =>
        {
            const author = await Author.retrieve(request.params.id, request.query.expand);

            if (!author)
            {
                throw Boom.notFound();
            }

            return author.serialize();
        }
    });

    server.route({
        method: "DELETE",
        path: "/authors/{id}",
        options: {
            validate: {
                params: Joi.object({
                    id: ID_SCHEMA(Config.ID_PREFIXES.AUTHOR).required(),
                }),
            },
        },
        handler: async (request, h) =>
        {
            const author = await Author.retrieve(request.params.id, [ "publisher" ]);

            if (!author)
            {
                throw Boom.notFound();
            }

            if (!(author.publisher instanceof Publisher))
            {
                throw Boom.badImplementation();
            }

            const authenticatedUser = request.auth.credentials.user as User;

            if (!author.publisher.isOwnedByUser(authenticatedUser))
            {
                throw Boom.forbidden();
            }

            await author.delete();

            return h.response();
        }
    });

    server.route({
        method: "GET",
        path: "/bundles/{id}",
        options: {
            validate: {
                params: Joi.object({
                    id: ID_SCHEMA(Config.ID_PREFIXES.BUNDLE).required(),
                }),
                query: Joi.object({
                    expand: EXPAND_QUERY_SCHEMA,
                }),
            },
            response: {
                schema: BUNDLE_SCHEMA,
            },
        },
        handler: async (request, h) =>
        {
            const bundle = await Bundle.retrieve(request.params.id, request.query.expand);

            if (!bundle)
            {
                throw Boom.notFound();
            }

            return bundle.serialize();
        }
    });

    server.route({
        method: "PATCH",
        path: "/bundles/{id}",
        options: {
            validate: {
                params: Joi.object({
                    id: ID_SCHEMA(Config.ID_PREFIXES.BUNDLE).required(),
                }),
                payload: BUNDLE_UPDATE_SCHEMA,
            },
            response: {
                schema: BUNDLE_SCHEMA,
            },
        },
        handler: async (request, h) =>
        {
            const bundle = await Bundle.retrieve(request.params.id, [ "organization" ]);

            if (!bundle)
            {
                throw Boom.notFound();
            }

            if (!(bundle.organization instanceof Organization))
            {
                throw Boom.badImplementation();
            }

            const authenticatedUser = request.auth.credentials.user as User;

            if (bundle.organization.owner.id !== authenticatedUser.id)
            {
                throw Boom.forbidden();
            }

            await bundle.update(request.payload as any);

            return bundle.serialize();
        }
    });

    server.route({
        method: "DELETE",
        path: "/bundles/{id}",
        options: {
            validate: {
                params: Joi.object({
                    id: ID_SCHEMA(Config.ID_PREFIXES.BUNDLE).required(),
                }),
            },
        },
        handler: async (request, h) =>
        {
            const bundle = await Bundle.retrieve(request.params.id, [ "organization" ]);

            if (!bundle)
            {
                throw Boom.notFound();
            }

            if (!(bundle.organization instanceof Organization))
            {
                throw Boom.badImplementation();
            }

            const authenticatedUser = request.auth.credentials.user as User;

            if (bundle.organization.owner.id !== authenticatedUser.id)
            {
                throw Boom.forbidden();
            }

            await bundle.delete();

            return h.response();
        }
    });

    server.route({
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
            const comment = await Comment.retrieve(request.params.id, request.query.expand);

            if (!comment)
            {
                throw Boom.notFound();
            }

            return comment.serialize();
        }
    });

    server.route({
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

            if (!comment)
            {
                throw Boom.notFound();
            }

            const authenticatedUser = request.auth.credentials.user as User;

            if (comment.user.id !== authenticatedUser.id)
            {
                throw Boom.forbidden();
            }

            await comment.update(request.payload as any);

            return comment.serialize();
        }
    });

    server.route({
        method: "DELETE",
        path: "/comments/{id}",
        options: {
            validate: {
                params: Joi.object({
                    id: ID_SCHEMA(Config.ID_PREFIXES.ARTICLE).required(),
                }),
            },
        },
        handler: async (request, h) =>
        {
            const comment = await Comment.retrieve(request.params.id);

            if (!comment)
            {
                throw Boom.notFound();
            }

            const authenticatedUser = request.auth.credentials.user as User;

            if (comment.user.id !== authenticatedUser.id)
            {
                throw Boom.forbidden();
            }

            await comment.delete();

            return h.response();
        }
    });

    server.route({
        method: "GET",
        path: "/organizations/{id}",
        options: {
            validate: {
                params: Joi.object({
                    id: ID_SCHEMA(Config.ID_PREFIXES.ORGANIZATION).required(),
                }),
            },
            response: {
                schema: ORGANIZATION_SCHEMA,
            },
        },
        handler: async (request, h) =>
        {
            const organization = await Organization.retrieve(request.params.id);

            if (!organization)
            {
                throw Boom.notFound();
            }

            const authenticatedUser = request.auth.credentials.user as User;

            if (organization.owner.id !== authenticatedUser.id)
            {
                throw Boom.forbidden();
            }

            return organization.serialize();
        }
    });

    server.route({
        method: "GET",
        path: "/organizations/{id}/publishers",
        options: {
            validate: {
                params: Joi.object({
                    id: ID_SCHEMA(Config.ID_PREFIXES.ORGANIZATION).required(),
                }),
            },
            response: {
                schema: Joi.array().items(PUBLISHER_SCHEMA).required(),
            },
        },
        handler: async (request, h) =>
        {
            const organization = await Organization.retrieve(request.params.id);

            if (!organization)
            {
                throw Boom.notFound();
            }

            const authenticatedUser = request.auth.credentials.user as User;

            if (organization.owner.id !== authenticatedUser.id)
            {
                throw Boom.forbidden();
            }

            const publishers = await Publisher.forOrganization(organization);

            return publishers.map(publisher => publisher.serialize());
        }
    });

    server.route({
        method: "POST",
        path: "/organizations",
        options: {
            validate: {
                payload: ORGANIZATION_CREATE_SCHEMA,
            },
            response: {
                schema: ORGANIZATION_SCHEMA,
            },
        },
        handler: async (request, h) =>
        {
            const authenticatedUser = request.auth.credentials.user as User;

            const organization = await Organization.create(request.payload as any, authenticatedUser);

            return organization.serialize();
        }
    });

    server.route({
        method: "POST",
        path: "/organizations/{id}/bundles",
        options: {
            validate: {
                query: Joi.object({
                    expand: EXPAND_QUERY_SCHEMA,
                }),
                payload: BUNDLE_CREATE_SCHEMA,
            },
            response: {
                schema: BUNDLE_SCHEMA,
            },
        },
        handler: async (request, h) =>
        {
            const organization = await Organization.retrieve(request.params.id);

            if (!organization)
            {
                throw Boom.notFound();
            }

            const authenticatedUser = request.auth.credentials.user as User;

            if (organization.owner.id !== authenticatedUser.id)
            {
                throw Boom.forbidden();
            }

            const bundle = await Bundle.create(
                request.payload as any,
                organization,
                request.query.expand,
            );

            return bundle.serialize();
        }
    });

    server.route({
        method: "PATCH",
        path: "/organizations/{id}",
        options: {
            validate: {
                params: Joi.object({
                    id: ID_SCHEMA(Config.ID_PREFIXES.ORGANIZATION).required(),
                }),
                payload: ORGANIZATION_UPDATE_SCHEMA,
            },
            response: {
                schema: ORGANIZATION_SCHEMA,
            },
        },
        handler: async (request, h) =>
        {
            const organization = await Organization.retrieve(request.params.id);

            if (!organization)
            {
                throw Boom.notFound();
            }

            const authenticatedUser = request.auth.credentials.user as User;

            if (organization.owner.id !== authenticatedUser.id)
            {
                throw Boom.forbidden();
            }

            await organization.update(request.payload as any);

            return organization.serialize();
        }
    });

    server.route({
        method: "DELETE",
        path: "/organizations/{id}",
        options: {
            validate: {
                params: Joi.object({
                    id: ID_SCHEMA(Config.ID_PREFIXES.ORGANIZATION).required(),
                }),
            },
        },
        handler: async (request, h) =>
        {
            const organization = await Organization.retrieve(request.params.id);

            if (!organization)
            {
                throw Boom.notFound();
            }

            const authenticatedUser = request.auth.credentials.user as User;

            if (organization.owner.id !== authenticatedUser.id)
            {
                throw Boom.forbidden();
            }

            await organization.delete();

            return h.response();
        }
    });

    server.route({
        method: "GET",
        path: "/publishers/{id}",
        options: {
            validate: {
                params: Joi.object({
                    id: ID_SCHEMA(Config.ID_PREFIXES.PUBLISHER).required(),
                }),
            },
            response: {
                schema: PUBLISHER_SCHEMA,
            },
        },
        handler: async (request, h) =>
        {
            const publisher = await Publisher.retrieve(request.params.id);

            if (!publisher)
            {
                throw Boom.notFound();
            }

            return publisher.serialize();
        }
    });

    server.route({
        method: "GET",
        path: "/publishers/{id}/articles",
        options: {
            validate: {
                params: Joi.object({
                    id: ID_SCHEMA(Config.ID_PREFIXES.PUBLISHER).required(),
                }),
                query: Joi.object({
                    expand: EXPAND_QUERY_SCHEMA,
                }),
            },
            response: {
                schema: Joi.array().items(ARTICLE_SCHEMA).required(),
            },
        },
        handler: async (request, h) =>
        {
            const publisher = await Publisher.retrieve(request.params.id);

            if (!publisher)
            {
                throw Boom.notFound();
            }

            const articles = await Article.forPublisher(publisher, request.query.expand);

            return articles.map(article => article.serialize({ preview: true }));
        }
    });

    server.route({
        method: "GET",
        path: "/publishers/{id}/authors",
        options: {
            validate: {
                params: Joi.object({
                    id: ID_SCHEMA(Config.ID_PREFIXES.PUBLISHER).required(),
                }),
                query: Joi.object({
                    expand: EXPAND_QUERY_SCHEMA,
                }),
            },
            response: {
                schema: Joi.array().items(AUTHOR_SCHEMA).required(),
            },
        },
        handler: async (request, h) =>
        {
            const publisher = await Publisher.retrieve(request.params.id);

            if (!publisher)
            {
                throw Boom.notFound();
            }

            const authenticatedUser = request.auth.credentials.user as User;

            if (!publisher.isOwnedByUser(authenticatedUser))
            {
                throw Boom.forbidden();
            }

            const authors = await Author.forPublisher(publisher, request.query.expand);

            return authors.map(author => author.serialize());
        }
    });

    server.route({
        method: "POST",
        path: "/publishers",
        options: {
            validate: {
                payload: PUBLISHER_CREATE_SCHEMA,
            },
            response: {
                schema: PUBLISHER_SCHEMA,
            },
        },
        handler: async (request, h) =>
        {
            /**
             * @todo
             * 
             * Check that the organization in the payload is owned by the authenticated user
             */

            const publisher = await Publisher.create(request.payload as any);

            return publisher.serialize();
        }
    });

    server.route({
        method: "POST",
        path: "/publishers/{id}/articles",
        options: {
            validate: {
                query: Joi.object({
                    expand: EXPAND_QUERY_SCHEMA,
                }),
                payload: ARTICLE_CREATE_SCHEMA,
            },
            response: {
                schema: ARTICLE_SCHEMA,
            },
        },
        handler: async (request, h) =>
        {
            const publisher = await Publisher.retrieve(request.params.id);

            if (!publisher)
            {
                throw Boom.notFound();
            }

            const authenticatedUser = request.auth.credentials.user as User;

            const author = await Author.retrieveWithUserAndPublisher(authenticatedUser, publisher);

            if (!author)
            {
                throw Boom.forbidden();
            }

            const article = await Article.create(
                request.payload as any,
                author,
                request.query.expand,
            );

            return article.serialize();
        }
    });

    server.route({
        method: "POST",
        path: "/publishers/{id}/authors",
        options: {
            validate: {
                params: Joi.object({
                    id: ID_SCHEMA(Config.ID_PREFIXES.PUBLISHER).required(),
                }),
                query: Joi.object({
                    expand: EXPAND_QUERY_SCHEMA,
                }),
                payload: AUTHOR_CREATE_SCHEMA,
            },
            response: {
                schema: AUTHOR_SCHEMA,
            },
        },
        handler: async (request, h) =>
        {
            const publisher = await Publisher.retrieve(request.params.id);

            if (!publisher)
            {
                throw Boom.notFound();
            }

            const authenticatedUser = request.auth.credentials.user as User;

            if (!publisher.isOwnedByUser(authenticatedUser))
            {
                throw Boom.forbidden();
            }

            const author = await Author.create(
                {
                    email: (request.payload as any).email,
                    publisher: publisher.id,
                },
                request.query.expand,
            );

            return author.serialize();
        }
    });

    server.route({
        method: "PATCH",
        path: "/publishers/{id}",
        options: {
            validate: {
                params: Joi.object({
                    id: ID_SCHEMA(Config.ID_PREFIXES.PUBLISHER).required(),
                }),
                payload: PUBLISHER_UPDATE_SCHEMA,
            },
            response: {
                schema: PUBLISHER_SCHEMA,
            },
        },
        handler: async (request, h) =>
        {
            const publisher = await Publisher.retrieve(request.params.id);

            if (!publisher)
            {
                throw Boom.notFound();
            }

            const authenticatedUser = request.auth.credentials.user as User;

            if (!publisher.isOwnedByUser(authenticatedUser))
            {
                throw Boom.forbidden();
            }

            await publisher.update(request.payload as any);

            return publisher.serialize();
        }
    });

    server.route({
        method: "DELETE",
        path: "/publishers/{id}",
        options: {
            validate: {
                params: Joi.object({
                    id: ID_SCHEMA(Config.ID_PREFIXES.PUBLISHER).required(),
                }),
            },
        },
        handler: async (request, h) =>
        {
            const publisher = await Publisher.retrieve(request.params.id);

            if (!publisher)
            {
                throw Boom.notFound();
            }

            const authenticatedUser = request.auth.credentials.user as User;

            if (!publisher.isOwnedByUser(authenticatedUser))
            {
                throw Boom.forbidden();
            }

            await publisher.delete();

            return h.response();
        }
    });

    server.route({
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
            const user = await User.retrieve(request.params.id);

            if (!user)
            {
                throw Boom.notFound();
            }

            const authenticatedUser = request.auth.credentials.user as User;

            if (user.id !== authenticatedUser.id)
            {
                throw Boom.forbidden();
            }

            return user.serialize();
        }
    });

    server.route({
        method: "GET",
        path: "/users/{id}/publishers",
        options: {
            validate: {
                params: Joi.object({
                    id: ID_SCHEMA(Config.ID_PREFIXES.USER).required(),
                }),
            },
            response: {
                schema: Joi.array().items(PUBLISHER_SCHEMA).required(),
            },
        },
        handler: async (request, h) =>
        {
            const user = await User.retrieve(request.params.id);

            if (!user)
            {
                throw Boom.notFound();
            }

            const authenticatedUser = request.auth.credentials.user as User;

            if (user.id !== authenticatedUser.id)
            {
                throw Boom.forbidden();
            }

            const publishers = await Publisher.forUser(user);

            return publishers.map(publisher => publisher.serialize());
        }
    });

    server.route({
        method: "GET",
        path: "/users/{id}/organizations",
        options: {
            validate: {
                params: Joi.object({
                    id: ID_SCHEMA(Config.ID_PREFIXES.USER).required(),
                }),
            },
            response: {
                schema: Joi.array().items(ORGANIZATION_SCHEMA).required(),
            },
        },
        handler: async (request, h) =>
        {
            const user = await User.retrieve(request.params.id);

            if (!user)
            {
                throw Boom.notFound();
            }

            const authenticatedUser = request.auth.credentials.user as User;

            if (user.id !== authenticatedUser.id)
            {
                throw Boom.forbidden();
            }

            const organizations = await Organization.forUser(user);

            return organizations.map(organization => organization.serialize());
        }
    });

    server.route({
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
        }
    });

    server.route({
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

            if (!user)
            {
                throw Boom.notFound();
            }

            const authenticatedUser = request.auth.credentials.user as User;

            if (user.id !== authenticatedUser.id)
            {
                throw Boom.forbidden();
            }

            await user.update(request.payload as any);

            return user.serialize();
        }
    });

    server.route({
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

            if (!user)
            {
                throw Boom.notFound();
            }

            const authenticatedUser = request.auth.credentials.user as User;

            if (user.id !== authenticatedUser.id)
            {
                throw Boom.forbidden();
            }

            await user.delete();

            return h.response();
        }
    });

    server.route({
        method: "GET",
        path: "/sessions/{id}",
        options: {
            validate: {
                params: Joi.object({
                    id: ID_SCHEMA(Config.ID_PREFIXES.SESSION).required(),
                }),
            },
            response: {
                schema: SESSION_SCHEMA,
            },
        },
        handler: async (request, h) =>
        {
            const session = await Session.retrieve(request.params.id);

            if (!session)
            {
                throw Boom.notFound();
            }

            const authenticatedUser = request.auth.credentials.user as User;

            if (session.user.id !== authenticatedUser.id)
            {
                throw Boom.forbidden();
            }

            return session.serialize();
        }
    });

    server.route({
        method: "POST",
        path: "/sessions",
        options: {
            auth: false,
            validate: {
                payload: SESSION_CREATE_SCHEMA,
            },
            response: {
                schema: SESSION_SCHEMA,
            },
        },
        handler: async (request, h) =>
        {
            const session = await Session.create(request.payload as any);

            return session.serialize();
        }
    });

    server.route({
        method: "DELETE",
        path: "/sessions/{id}",
        options: {
            validate: {
                params: Joi.object({
                    id: ID_SCHEMA(Config.ID_PREFIXES.SESSION).required(),
                }),
            },
        },
        handler: async (request, h) =>
        {
            const session = await Session.retrieve(request.params.id);

            if (!session)
            {
                throw Boom.notFound();
            }

            const authenticatedUser = request.auth.credentials.user as User;

            if (session.user.id !== authenticatedUser.id)
            {
                throw Boom.forbidden();
            }

            await session.delete();

            return h.response();
        }
    });

    server.route({
        method: "POST",
        path: "/webhooks/stripe",
        options: {
            auth: false,
            payload: {
                output: "data",
                parse: false,
            },
        },
        handler: async (request, h) =>
        {
            const stripe = new Stripe(process.env.STRIPE_SECRET_API_KEY ?? "", { apiVersion: "2020-08-27" });

            let event: Stripe.Event;

            try
            {
                event = stripe.webhooks.constructEvent(
                    request.payload as any,
                    request.headers["stripe-signature"],
                    process.env.STRIPE_WEBHOOK_SECRET ?? "",
                );
            }
            catch (err)
            {
                throw Boom.badRequest();
            }

            switch (event.type)
            {
                case "price.created":
                {
                    const price = event.data.object as Stripe.Price;

                    const client = await Database.pool.connect();

                    const result = await client.query(
                        `update "bundles" set "stripe_price_id" = $1 where "id" = $2`,
                        [
                            price.id,
                            price.metadata.bundle_id,
                        ],
                    );

                    if (result.rowCount === 0)
                    {
                        throw Boom.badImplementation();
                    }

                    break;
                }
                case "price.deleted":
                {
                    break;
                }
                case "price.updated":
                {
                    break;
                }
                case "product.created":
                {
                    const product = event.data.object as Stripe.Product;

                    const client = await Database.pool.connect();

                    const result = await client.query(
                        `update "bundles" set "stripe_product_id" = $1 where "id" = $2`,
                        [
                            product.id,
                            product.metadata.bundle_id,
                        ],
                    );

                    if (result.rowCount === 0)
                    {
                        throw Boom.badImplementation();
                    }

                    break;
                }
                case "product.deleted":
                {
                    break;
                }
                case "product.updated":
                {
                    break;
                }
            }

            return { received: true };
        }
    });

    server.start();
}

init();
