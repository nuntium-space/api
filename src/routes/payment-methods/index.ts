import Boom from "@hapi/boom";
import { ServerRoute } from "@hapi/hapi";
import Joi from "joi";
import { Config } from "../../config/Config";
import { ID_SCHEMA, PAYMENT_METHOD_SCHEMA, STRING_SCHEMA } from "../../config/schemas";
import { PaymentMethod } from "../../models/PaymentMethod";
import { User } from "../../models/User";

export default <ServerRoute[]>[
    {
        method: "GET",
        path: "/users/{id}/payment-methods",
        options: {
            validate: {
                params: Joi.object({
                    id: ID_SCHEMA(Config.ID_PREFIXES.USER).required(),
                }),
            },
            response: {
                schema: Joi.array().items(PAYMENT_METHOD_SCHEMA).required(),
            },
        },
        handler: async (request, h) =>
        {
            const authenticatedUser = request.auth.credentials.user as User;

            if (request.params.id !== authenticatedUser.id)
            {
                throw Boom.forbidden();
            }

            const paymentMethods = await PaymentMethod.forUser(authenticatedUser);

            return paymentMethods.map(paymentMethod => ({
                ...paymentMethod.serialize(),
                __metadata: {
                    is_default: authenticatedUser.default_payment_method?.id === paymentMethod.id,
                },
            }));
        },
    },
    {
        method: "POST",
        path: "/users/{id}/payment-methods",
        options: {
            validate: {
                params: Joi.object({
                    id: ID_SCHEMA(Config.ID_PREFIXES.USER).required(),
                }),
                payload: Joi.object({
                    // ID of a Stripe Payment Method
                    id: STRING_SCHEMA.required(),
                }),
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

            const paymentMethodId = (request.payload as any).id as string;

            await Config.STRIPE.paymentMethods
                .attach(
                    paymentMethodId,
                    {
                        customer: authenticatedUser.stripe_customer_id,
                    },
                )
                .catch(() =>
                {
                    throw Boom.badImplementation();
                });

            await Config.STRIPE.customers
                .update(
                    authenticatedUser.stripe_customer_id,
                    {
                        invoice_settings: {
                            default_payment_method: paymentMethodId,
                        },
                    },
                )
                .catch(() =>
                {
                    throw Boom.badImplementation();
                });

            return h.response();
        },
    },
    {
        method: "PUT",
        path: "/users/{id}/payment-methods/default",
        options: {
            validate: {
                params: Joi.object({
                    id: ID_SCHEMA(Config.ID_PREFIXES.USER).required(),
                }),
                payload: Joi.object({
                    id: ID_SCHEMA(Config.ID_PREFIXES.PAYMENT_METHOD).required(),
                }),
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

            const paymentMethod = await PaymentMethod.retrieve((request.payload as any).id);

            await Config.STRIPE.customers
                .update(
                    authenticatedUser.stripe_customer_id,
                    {
                        invoice_settings: {
                            default_payment_method: paymentMethod.stripe_id,
                        },
                    },
                )
                .catch(() =>
                {
                    throw Boom.badImplementation();
                });

            return h.response();
        },
    },
    {
        method: "DELETE",
        path: "/payment-methods/{id}",
        options: {
            validate: {
                params: Joi.object({
                    id: ID_SCHEMA(Config.ID_PREFIXES.PAYMENT_METHOD).required(),
                }),
            },
        },
        handler: async (request, h) =>
        {
            const authenticatedUser = request.auth.credentials.user as User;

            const paymentMethod = await PaymentMethod.retrieve(request.params.id);

            if (paymentMethod.user.id !== authenticatedUser.id)
            {
                throw Boom.forbidden();
            }

            /**
             * The default payment method cannot be deleted if
             * the user has at least one active subscription
             */
            if
            (
                authenticatedUser.default_payment_method?.id === paymentMethod.id
                && await authenticatedUser.hasActiveSubscriptions()
            )
            {
                throw Boom.forbidden();
            }

            await Config.STRIPE.paymentMethods
                .detach(paymentMethod.stripe_id)
                .catch(() =>
                {
                    throw Boom.badImplementation();
                });

            return h.response();
        },
    },
];
