import Boom from "@hapi/boom";
import { ServerRoute } from "@hapi/hapi";
import Stripe from "stripe";
import { Config } from "../../config/Config";
import { Organization } from "../../models/Organization";
import { Subscription } from "../../models/Subscription";
import { User } from "../../models/User";
import Database from "../../utilities/Database";
import Utilities from "../../utilities/Utilities";

export default <ServerRoute[]>[
    {
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
                case "customer.updated":
                {
                    const customer = event.data.object as Stripe.Customer;

                    if (!customer.email)
                    {
                        throw Boom.badImplementation();
                    }

                    const user = await User.retrieve(customer.metadata.user_id);

                    await user.update({ email: customer.email });

                    if (customer.invoice_settings.default_payment_method !== null)
                    {
                        if (typeof customer.invoice_settings.default_payment_method !== "string")
                        {
                            throw Boom.badImplementation();
                        }

                        await user.setDefaultPaymentMethod(customer.invoice_settings.default_payment_method);
                    }
                    else
                    {
                        await user.removeDefaultPaymentMethod();
                    }

                    break;
                }
                case "customer.subscription.created":
                {
                    const subscription = event.data.object as Stripe.Subscription;

                    await Database.pool
                        .query(
                            `
                            insert into "subscriptions"
                                ("id", "status", "user", "price", "current_period_end", "cancel_at_period_end", "deleted", "stripe_subscription_id")
                            values
                                ($1, $2, $3, $4, $5, $6, $7, $8)
                            `,
                            [
                                Utilities.id(Config.ID_PREFIXES.SUBSCRIPTION),
                                subscription.status,
                                subscription.metadata.user_id,
                                subscription.metadata.price_id,
                                new Date(subscription.current_period_end * 1000),
                                subscription.cancel_at_period_end,
                                false,
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

                    await Database.pool
                        .query(
                            `
                            update "subscriptions"
                            set
                                "status" = $1,
                                "deleted" = $2
                            where
                                "stripe_subscription_id" = $3
                            `,
                            [
                                subscription.status,
                                true,
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
                            where
                                "stripe_subscription_id" = $3
                            `,
                            [
                                subscription.status,
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
                                "status" = $1
                            where
                                "stripe_subscription_id" = $2
                            `,
                            [
                                subscription.status,
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
                            `update "prices" set "stripe_price_id" = $1 where "id" = $2`,
                            [
                                price.id,
                                price.metadata.price_id,
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
        },
    },
];
