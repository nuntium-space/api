import "dotenv/config";

import Bell from "@hapi/bell";
import Boom from "@hapi/boom";
import Cookie from "@hapi/cookie";
import Hapi from "@hapi/hapi";
import Joi, { ValidationError } from "joi";
import qs from "qs";
import { Config } from "../src/config/Config";
import { EXPAND_QUERY_SCHEMA } from "../src/config/schemas";
import { Article } from "../src/models/Article";
import { Session } from "../src/models/Session";
import Database from "../src/utilities/Database";
import routes from "../src/routes";
import { Schema } from "../src/config/Schema";

const server = Hapi.server({
    port: process.env.PORT,
    routes: {
        cors: {
            origin: [ Config.CLIENT_HOST ],
            credentials: true,
        },
        validate: {
            options: {
                abortEarly: false,
            },
            failAction: async (request, h, error) =>
            {
                if (error instanceof ValidationError)
                {
                    throw Boom.badRequest(undefined, error.details.map(e =>
                    {
                        return {
                            field: e.path.join("."),
                            error: e.type,
                        };
                    }));
                }

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

    await server.register(Bell);
    await server.register(Cookie);

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

                if (session.hasExpired())
                {
                    throw Boom.unauthorized();
                }

                return h.authenticated({ credentials: { session } });
            },
        };
    });

    server.auth.strategy("token", "token");

    server.auth.strategy("cookie", "cookie", {
        cookie: {
            name: "session_id",
            password: "password-should-be-32-characters",
            ttl: Config.SESSION_DURATION_IN_SECONDS * 1000,
            domain: new URL(Config.CLIENT_HOST).hostname,
            path: "/",
            clearInvalid: true,
            isSameSite: "Strict",
            isSecure: Config.IS_PRODUCTION,
            isHttpOnly: true,
        },
        keepAlive: false,
        validateFunc: async (request, { id }: { id?: string }) =>
        {
            if (!id)
            {
                throw Boom.unauthorized();
            }

            const session = await Session.retrieve(id);

            if (session.hasExpired())
            {
                throw Boom.unauthorized();
            }

            return { valid: true, credentials: { session } };
        },
    });

    server.auth.strategy("facebook", "bell", {
        provider: "facebook",
        password: process.env.AUTH_COOKIE_ENCRYPTION_PASSWORD,
        clientId: process.env.FACEBOOK_OAUTH_CLIENT_ID,
        clientSecret: process.env.FACEBOOK_OAUTH_CLIENT_SECRET,
        isSecure: Config.IS_PRODUCTION,
    });

    server.auth.strategy("google", "bell", {
        provider: "google",
        password: process.env.AUTH_COOKIE_ENCRYPTION_PASSWORD,
        clientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
        clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
        isSecure: Config.IS_PRODUCTION,
    });

    server.auth.strategy("twitter", "bell", {
        provider: "twitter",
        config: {
            getMethod: "account/verify_credentials",
            getParams: {
                include_email: "true",
            },
        },
        password: process.env.AUTH_COOKIE_ENCRYPTION_PASSWORD,
        clientId: process.env.TWITTER_OAUTH_CLIENT_ID,
        clientSecret: process.env.TWITTER_OAUTH_CLIENT_SECRET,
        isSecure: Config.IS_PRODUCTION,
    });

    server.auth.default({
        // Allow both cookie and token authentication
        strategies: [
            "cookie",
            "token",
        ],
    });

    server.ext("onPreResponse", (request, h) =>
    {
        const { response } = request;

        if (response instanceof Boom.Boom && response.data)
        {
            response.output.payload.details = response.data;
        }

        return h.continue;
    });

    server.route(routes);

    /**
     * IMPORTANT:
     * 
     * RESULTS ARE NOT LIMITED TO WHAT USERS HAVE ACCESS TO.
     * 
     * ONLY A SHORT SNIPPET IS SENT TO THE USER.
     */
    server.route({
        method: "GET",
        path: "/search",
        options: {
            validate: {
                query: Joi.object({
                    query: Schema.STRING.required(),
                    limit: Joi.number().integer().min(0).max(30).required(),
                    offset: Joi.number().integer().min(0).required(),
                    expand: EXPAND_QUERY_SCHEMA,
                }),
            },
            response: {
                schema: Schema.ARRAY(Article.SCHEMA.OBJ).required(),
            },
        },
        handler: async (request, h) =>
        {
            const authenticatedUser = (request.auth.credentials.session as Session).user;

            const result = await Config.ELASTICSEARCH.search({
                index: "articles",
                size: request.query.limit,
                from: request.query.offset,
                body: {
                    query: {
                        multi_match: {
                            query: request.query.query,
                            fields: [ "title", "content" ],
                            fuzziness: "AUTO",
                        },
                    },
                    stored_fields: [],
                },
            });

            const ids = result.body.hits.hits.map((hit: any) => hit._id);

            const articles = await Article.retrieveMultiple(ids, request.query.expand);

            return articles.map(article => article.serialize({ for: authenticatedUser }));
        },
    });

    server.route({
        method: "GET",
        path: "/users/{id}/feed",
        options: {
            validate: {
                params: Joi.object({
                    id: Schema.ID.USER.required(),
                }),
                query: Joi.object({
                    limit: Joi.number().integer().min(0).max(30).required(),
                    offset: Joi.number().integer().min(0).required(),
                    expand: EXPAND_QUERY_SCHEMA,
                }),
            },
            response: {
                schema: Schema.ARRAY(Article.SCHEMA.OBJ).required(),
            },
        },
        handler: async (request, h) =>
        {
            const authenticatedUser = (request.auth.credentials.session as Session).user;

            if (request.params.id !== authenticatedUser.id)
            {
                throw Boom.forbidden();
            }

            const articles = await Article.forFeed(authenticatedUser, {
                limit: request.query.limit,
                offset: request.query.offset,
                expand: request.query.expand,
            });

            return articles.map(article => article.serialize({ for: authenticatedUser }));
        },
    });

    server.start();
}

init();
