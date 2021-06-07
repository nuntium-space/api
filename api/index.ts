import "dotenv/config";

import Bell from "@hapi/bell";
import Boom from "@hapi/boom";
import Cookie from "@hapi/cookie";
import Hapi from "@hapi/hapi";
import Joi, { ValidationError } from "joi";
import qs from "qs";
import { Config } from "../src/config/Config";
import {
    ARTICLE_SCHEMA,
    EXPAND_QUERY_SCHEMA,
    ID_SCHEMA,
    STRING_SCHEMA,
} from "../src/config/schemas";
import { Article } from "../src/models/Article";
import { Session } from "../src/models/Session";
import { User } from "../src/models/User";
import Database from "../src/utilities/Database";
import routes from "../src/routes";

const server = Hapi.server({
    port: process.env.PORT,
    routes: {
        cors: {
            origin: [ Config.CLIENT_HOST ],
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

const retrieveUserWithSessionId = async (sessionId: string): Promise<User> =>
{
    const session = await Session.retrieve(sessionId);

    if (session.hasExpired())
    {
        throw Boom.unauthorized();
    }

    return session.user;
}

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

                const user = await retrieveUserWithSessionId(authorization.split(" ")[1]);

                return h.authenticated({ credentials: { user } });
            },
        };
    });

    server.auth.strategy("token", "token");

    server.auth.strategy("cookie", "cookie", {
        cookie: {
            name: "session_id",
            password: "password-should-be-32-characters",
            isSecure: Config.IS_PRODUCTION,
        },
        redirectTo: Config.CLIENT_HOST,
        validateFunc: async (request, session) =>
        {
            if (!session)
            {
                throw Boom.unauthorized();
            }

            console.log(session);

            const user = await retrieveUserWithSessionId((session as any).id);

            return { valid: true, credentials: { user } };
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
                    query: STRING_SCHEMA.required(),
                    limit: Joi.number().integer().min(0).max(30).required(),
                    offset: Joi.number().integer().min(0).required(),
                    expand: EXPAND_QUERY_SCHEMA,
                }),
            },
            response: {
                schema: Joi.array().items(ARTICLE_SCHEMA).required(),
            },
        },
        handler: async (request, h) =>
        {
            const authenticatedUser = request.auth.credentials.user as User;

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
                    id: ID_SCHEMA(Config.ID_PREFIXES.USER).required(),
                }),
                query: Joi.object({
                    limit: Joi.number().integer().min(0).max(30).required(),
                    offset: Joi.number().integer().min(0).required(),
                    expand: EXPAND_QUERY_SCHEMA,
                }),
            },
            response: {
                schema: Joi.array().items(ARTICLE_SCHEMA).required(),
            },
        },
        handler: async (request, h) =>
        {
            const authenticatedUser = request.auth.credentials.user as User;

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
