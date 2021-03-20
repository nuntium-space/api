import dotenv from "dotenv";

dotenv.config();

import Boom from "@hapi/boom";
import Hapi from "@hapi/hapi";
import Joi from "joi";
import qs from "qs";
import { Config } from "./config/Config";
import {
    ARTICLE_SCHEMA,
    EXPAND_QUERY_SCHEMA,
    ID_SCHEMA,
    STRING_SCHEMA,
} from "./config/schemas";
import { Article } from "./models/Article";
import { Organization } from "./models/Organization";
import { Session } from "./models/Session";
import { User } from "./models/User";
import Database from "./utilities/Database";
import Stripe from "stripe";
import { Subscription } from "./models/Subscription";
import Utilities from "./utilities/Utilities";
import routes from "./routes";

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

                if (session.hasExpired())
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

            return articles.map(article => article.serialize({ preview: true }));
        }
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

            return articles.map(article => article.serialize({ preview: true }));
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
            let event: Stripe.Event;

            try
            {
                event = Config.STRIPE.webhooks.constructEvent(
                    request.payload as any,
                    request.headers["stripe-signature"],
                    process.env.STRIPE_WEBHOOK_SECRET ?? "",
                );
            }
            catch (err)
            {
                throw Boom.forbidden();
            }

            switch (event.type)
            {
                case "account.updated":
                {
                    const account = event.data.object as Stripe.Account;

                    if (!account.metadata)
                    {
                        throw Boom.badImplementation();
                    }

                    const organization = await Organization.retrieve(account.metadata.organization_id);

                    await organization.update({
                        stripe_account_enabled: account.charges_enabled,
                    });

                    break;
                }
                case "customer.created":
                {
                    const customer = event.data.object as Stripe.Customer;

                    await Database.pool
                        .query(
                            `update "users" set "stripe_customer_id" = $1 where "id" = $2`,
                            [
                                customer.id,
                                customer.metadata.user_id,
                            ],
                        )
                        .catch(() =>
                        {
                            throw Boom.badImplementation();
                        });

                    break;
                }
                case "customer.subscription.created":
                {
                    const subscription = event.data.object as Stripe.Subscription;

                    await Database.pool
                        .query(
                            `
                            insert into "subscriptions"
                                ("id", "status", "user", "bundle", "current_period_end", "cancel_at_period_end", "stripe_subscription_id")
                            values
                                ($1, $2, $3, $4, $5, $6, $7)
                            `,
                            [
                                Utilities.id(Config.ID_PREFIXES.SUBSCRIPTION),
                                subscription.status,
                                subscription.metadata.user_id,
                                subscription.metadata.bundle_id,
                                new Date(subscription.current_period_end * 1000),
                                subscription.cancel_at_period_end,
                                subscription.id,
                            ],
                        )
                        .catch(() =>
                        {
                            throw Boom.badRequest();
                        });

                    break;
                }
                case "customer.subscription.deleted":
                {
                    const subscription = event.data.object as Stripe.Subscription;

                    if (!subscription.canceled_at)
                    {
                        throw Boom.badImplementation();
                    }

                    await Database.pool
                        .query(
                            `
                            update "subscriptions"
                            set
                                "status" = $1,
                                "canceled_at" = $2
                            where
                                "stripe_subscription_id" = $3
                            `,
                            [
                                subscription.status,
                                new Date(subscription.canceled_at * 1000).toISOString(),
                                subscription.id,
                            ],
                        )
                        .catch(() =>
                        {
                            throw Boom.badRequest();
                        });

                    break;
                }
                case "customer.subscription.updated":
                {
                    const subscription = event.data.object as Stripe.Subscription;

                    await Database.pool
                        .query(
                            `
                            update "subscriptions"
                            set
                                "status" = $1,
                                "cancel_at_period_end" = $2
                                "canceled_at" = $3
                            where
                                "stripe_subscription_id" = $4
                            `,
                            [
                                subscription.status,
                                subscription.cancel_at_period_end,
                                subscription.canceled_at
                                    ? new Date(subscription.canceled_at * 1000).toISOString()
                                    : null,
                                subscription.id,
                            ],
                        )
                        .catch(() =>
                        {
                            throw Boom.badRequest();
                        });

                    break;
                }
                case "customer.updated":
                {
                    const customer = event.data.object as Stripe.Customer;

                    if (!customer.email)
                    {
                        throw Boom.badImplementation();
                    }

                    const user = await User.retrieveWithCustomerId(customer.id);

                    await user.update({ email: customer.email });

                    break;
                }
                case "invoice.paid":
                {
                    const invoice = event.data.object as Stripe.Invoice;

                    if (typeof invoice.subscription !== "string")
                    {
                        throw Boom.badImplementation();
                    }

                    const { current_period_end, cancel_at_period_end } = await Config.STRIPE.subscriptions
                        .retrieve(invoice.subscription)
                        .catch(() =>
                        {
                            throw Boom.badImplementation();
                        });

                    const subscription = await Subscription.retrieveWithSubscriptionId(invoice.subscription);

                    await subscription.update({ current_period_end, cancel_at_period_end });

                    break;
                }
                case "invoice.payment_failed":
                {
                    const invoice = event.data.object as Stripe.Invoice;

                    if (typeof invoice.subscription !== "string")
                    {
                        throw Boom.badImplementation();
                    }

                    const subscription = await Config.STRIPE.subscriptions.retrieve(invoice.subscription);

                    await Database.pool
                        .query(
                            `
                            update "subscriptions"
                            set
                                "status" = $1,
                                "canceled_at" = $2
                            where
                                "stripe_subscription_id" = $3
                            `,
                            [
                                subscription.status,
                                subscription.canceled_at
                                    ? new Date(subscription.canceled_at * 1000).toISOString()
                                    : null,
                                subscription.id,
                            ],
                        )
                        .catch(() =>
                        {
                            throw Boom.badRequest();
                        });

                    break;
                }
                case "payment_method.attached":
                {
                    const paymentMethod = event.data.object as Stripe.PaymentMethod;

                    if (typeof paymentMethod.customer !== "string")
                    {
                        throw Boom.badImplementation();
                    }

                    const user = await User.retrieveWithCustomerId(paymentMethod.customer);

                    await Database.pool
                        .query(
                            `
                            insert into "payment_methods"
                                ("id", "type", "data", "user", "stripe_id")
                            values
                                ($1, $2, $3, $4, $5)
                            `,
                            [
                                Utilities.id(Config.ID_PREFIXES.PAYMENT_METHOD),
                                paymentMethod.type,
                                paymentMethod[paymentMethod.type],
                                user.id,
                                paymentMethod.id,
                            ],
                        )
                        .catch(() =>
                        {
                            throw Boom.badImplementation();
                        });

                    break;
                }
                case "payment_method.updated":
                case "payment_method.automatically_updated":
                {
                    const paymentMethod = event.data.object as Stripe.PaymentMethod;

                    await Database.pool
                        .query(
                            `update "payment_methods" set "data" = $1 where "stripe_id" = $1`,
                            [ paymentMethod[paymentMethod.type], paymentMethod.id ],
                        )
                        .catch(() =>
                        {
                            throw Boom.badImplementation();
                        });

                    break;
                }
                case "payment_method.detached":
                {
                    const paymentMethod = event.data.object as Stripe.PaymentMethod;

                    await Database.pool
                        .query(
                            `delete from "payment_methods" where "stripe_id" = $1`,
                            [ paymentMethod.id ],
                        )
                        .catch(() =>
                        {
                            throw Boom.badImplementation();
                        });

                    break;
                }
                case "price.created":
                {
                    const price = event.data.object as Stripe.Price;

                    await Database.pool
                        .query(
                            `update "bundles" set "stripe_price_id" = $1 where "id" = $2`,
                            [
                                price.id,
                                price.metadata.bundle_id,
                            ],
                        )
                        .catch(() =>
                        {
                            throw Boom.badImplementation();
                        });

                    break;
                }
                case "product.created":
                {
                    const product = event.data.object as Stripe.Product;

                    await Database.pool
                        .query(
                            `update "bundles" set "stripe_product_id" = $1 where "id" = $2`,
                            [
                                product.id,
                                product.metadata.bundle_id,
                            ],
                        )
                        .catch(() =>
                        {
                            throw Boom.badImplementation();
                        });

                    break;
                }
            }

            return { received: true };
        }
    });

    server.start();
}

init();
