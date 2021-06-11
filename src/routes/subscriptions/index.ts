import Boom from "@hapi/boom";
import { ServerRoute } from "@hapi/hapi";
import Joi from "joi";
import { Config } from "../../config/Config";
import { Schema } from "../../config/Schema";
import { Bundle } from "../../models/Bundle";
import { Organization } from "../../models/Organization";
import { Price } from "../../models/Price";
import { Session } from "../../models/Session";
import { Subscription } from "../../models/Subscription";

export default <ServerRoute[]>[
    {
        method: "GET",
        path: "/users/{id}/subscriptions",
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
                schema: Schema.ARRAY(Subscription.SCHEMA.OBJ).required(),
            },
        },
        handler: async (request, h) =>
        {
            const authenticatedUser = (request.auth.credentials.session as Session).user;

            if (request.params.id !== authenticatedUser.id)
            {
                throw Boom.forbidden();
            }

            const subscriptions = await Subscription.forUser(authenticatedUser, request.query.expand);

            return subscriptions.map(subscription => subscription.serialize({ for: authenticatedUser }));
        },
    },
    {
        method: "POST",
        path: "/users/{id}/subscriptions",
        options: {
            validate: {
                params: Joi.object({
                    id: Schema.ID.USER.required(),
                }),
                query: Joi.object({
                    expand: Schema.EXPAND_QUERY,
                }),
                payload: Subscription.SCHEMA.CREATE,
            },
        },
        handler: async (request, h) =>
        {
            const authenticatedUser = (request.auth.credentials.session as Session).user;

            if (request.params.id !== authenticatedUser.id)
            {
                throw Boom.forbidden();
            }

            if (!authenticatedUser.stripe_customer_id)
            {
                throw Boom.badImplementation();
            }

            const price = await Price.retrieve((request.payload as any).price, [ "bundle", "bundle.organization" ]);

            if
            (
                !price.stripe_price_id
                || !(price.bundle instanceof Bundle)
                || !(price.bundle.organization instanceof Organization)
            )
            {
                throw Boom.badImplementation();
            }

            if (!price.bundle.organization.stripe_account_enabled)
            {
                throw Boom.badRequest(undefined, [
                    {
                        field: "subscription",
                        error: `The organization that owns the bundle '${price.bundle.id}' hasn't enabled payments`,
                    },
                ]);
            }

            if (!await authenticatedUser.canSubscribeToBundle(price.bundle))
            {
                throw Boom.conflict(undefined, [
                    {
                        field: "subscription",
                        error: `The user '${authenticatedUser.id}' is already subscribed to the bundle '${price.bundle.id}'`,
                    },
                ]);
            }

            if (!price.active)
            {
                throw Boom.forbidden(undefined, [
                    {
                        field: "subscription",
                        error: `The price '${price.id}' is not active`,
                    },
                ]);
            }

            if (!price.bundle.active)
            {
                throw Boom.forbidden(undefined, [
                    {
                        field: "subscription",
                        error: `The bundle '${price.bundle.id}' is not active`,
                    },
                ]);
            }

            await Config.STRIPE.subscriptions
                .create({
                    customer: authenticatedUser.stripe_customer_id,
                    items: [
                        {
                            price: price.stripe_price_id,
                            quantity: 1,
                        },
                    ],
                    application_fee_percent: Config.STRIPE_CONNECT_FEE_PERCENT,
                    transfer_data: {
                        destination: price.bundle.organization.stripe_account_id,
                    },
                    metadata: {
                        user_id: authenticatedUser.id,
                        price_id: price.id,
                    },
                })
                .catch(async () =>
                {
                    throw Boom.badRequest();
                });

            return h.response();
        },
    },
];
