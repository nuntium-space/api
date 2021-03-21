import Boom from "@hapi/boom";
import { ServerRoute } from "@hapi/hapi";
import Joi from "joi";
import { Config } from "../../config/Config";
import { EXPAND_QUERY_SCHEMA, ID_SCHEMA, SUBSCRIPTION_CREATE_SCHEMA, SUBSCRIPTION_SCHEMA } from "../../config/schemas";
import { Bundle } from "../../models/Bundle";
import { Organization } from "../../models/Organization";
import { Subscription } from "../../models/Subscription";
import { User } from "../../models/User";

export default <ServerRoute[]>[
    {
        method: "GET",
        path: "/users/{id}/subscriptions",
        options: {
            validate: {
                params: Joi.object({
                    id: ID_SCHEMA(Config.ID_PREFIXES.USER).required(),
                }),
                query: Joi.object({
                    expand: EXPAND_QUERY_SCHEMA,
                }),
            },
            response: {
                schema: Joi.array().items(SUBSCRIPTION_SCHEMA).required(),
            },
        },
        handler: async (request, h) =>
        {
            const authenticatedUser = request.auth.credentials.user as User;

            if (request.params.id !== authenticatedUser.id)
            {
                throw Boom.forbidden();
            }

            const subscriptions = await Subscription.forUser(authenticatedUser, request.query.expand);

            return subscriptions.map(subscription => subscription.serialize());
        },
    },
    {
        method: "POST",
        path: "/users/{id}/subscriptions",
        options: {
            validate: {
                params: Joi.object({
                    id: ID_SCHEMA(Config.ID_PREFIXES.USER).required(),
                }),
                query: Joi.object({
                    expand: EXPAND_QUERY_SCHEMA,
                }),
                payload: SUBSCRIPTION_CREATE_SCHEMA,
            },
        },
        handler: async (request, h) =>
        {
            const authenticatedUser = request.auth.credentials.user as User;

            if (request.params.id !== authenticatedUser.id)
            {
                throw Boom.forbidden();
            }

            if (!authenticatedUser.stripe_customer_id)
            {
                throw Boom.badImplementation();
            }

            const bundle = await Bundle.retrieve((request.payload as any).bundle, [ "organization" ]);

            if (!bundle.stripe_price_id || !(bundle.organization instanceof Organization))
            {
                throw Boom.badImplementation();
            }

            if (!bundle.organization.stripe_account_enabled)
            {
                throw Boom.badRequest(`The organization that owns the bundle '${bundle.id}' hasn't enabled payments`);
            }

            if (!await authenticatedUser.canSubscribeToBundle(bundle))
            {
                throw Boom.conflict(`The user '${authenticatedUser.id}' is already subscribed to the bundle '${bundle.id}'`);
            }

            if (!bundle.active)
            {
                throw Boom.forbidden(`The bundle '${bundle.id}' is not active`);
            }

            await Config.STRIPE.subscriptions
                .create({
                    customer: authenticatedUser.stripe_customer_id,
                    items: [
                        {
                            price: bundle.stripe_price_id,
                            quantity: 1,
                        },
                    ],
                    application_fee_percent: Config.STRIPE_CONNECT_FEE_PERCENT,
                    transfer_data: {
                        destination: bundle.organization.stripe_account_id,
                    },
                    metadata: {
                        user_id: authenticatedUser.id,
                        bundle_id: bundle.id,
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
