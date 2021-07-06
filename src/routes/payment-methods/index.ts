import Boom from "@hapi/boom";
import { ServerRoute } from "@hapi/hapi";
import Joi from "joi";
import type Stripe from "stripe";
import { Config } from "../../config/Config";
import { Schema } from "../../config/Schema";
import { PaymentMethod } from "../../models/PaymentMethod";
import { PAYMENT_METHOD_SCHEMA } from "../../types/payment-method";
import Utilities from "../../utilities/Utilities";

export default <ServerRoute[]>[
  {
    method: "GET",
    path: "/users/{id}/payment-methods",
    options: {
      validate: {
        params: Joi.object({
          id: Schema.ID.USER.required(),
        }),
      },
      response: {
        schema: Schema.ARRAY(PAYMENT_METHOD_SCHEMA.OBJ).required(),
      },
    },
    handler: async (request, h) => {
      const [authenticatedUser] = Utilities.getAuthenticatedUser(request);

      if (request.params.id !== authenticatedUser.id) {
        throw Boom.forbidden();
      }

      const paymentMethods = await PaymentMethod.forUser(authenticatedUser);

      const defaultPaymentMethod = await PaymentMethod.retrieveDefaultForUser(
        authenticatedUser.id
      );

      return paymentMethods.map((paymentMethod) => ({
        ...paymentMethod.serialize({ for: authenticatedUser }),
        __metadata: {
          is_default: defaultPaymentMethod?.id === paymentMethod.id,
        },
      }));
    },
  },
  {
    method: "GET",
    path: "/payment-methods/new",
    handler: async (request, h) => {
      const [authenticatedUser] = Utilities.getAuthenticatedUser(request);

      if (!authenticatedUser.stripe_customer_id) {
        throw Boom.badImplementation();
      }

      const userSettings = await authenticatedUser.retrieveSettings();

      const { url } = await Config.STRIPE.checkout.sessions
        .create({
          mode: "setup",
          payment_method_types: [ "card" ],
          locale: userSettings.language as Stripe.Checkout.SessionCreateParams.Locale ?? "en",
          success_url: Config.CLIENT_URL,
          cancel_url: Config.CLIENT_URL,
          customer: authenticatedUser.stripe_customer_id,
        })
        .catch(() => {
          throw Boom.badImplementation();
        });

        if (!url)
        {
          throw Boom.badImplementation();
        }
  
        return h.redirect(url);
    },
  },
  {
    method: "PUT",
    path: "/users/{id}/payment-methods/default",
    options: {
      validate: {
        params: Joi.object({
          id: Schema.ID.USER.required(),
        }),
        payload: Joi.object({
          id: Schema.ID.PAYMENT_METHOD.required(),
        }),
      },
    },
    handler: async (request, h) => {
      const [authenticatedUser] = Utilities.getAuthenticatedUser(request);

      if (request.params.id !== authenticatedUser.id) {
        throw Boom.forbidden();
      }

      if (!authenticatedUser.stripe_customer_id) {
        throw Boom.badImplementation();
      }

      const paymentMethod = await PaymentMethod.retrieve(
        (request.payload as any).id
      );

      await Config.STRIPE.customers
        .update(authenticatedUser.stripe_customer_id, {
          invoice_settings: {
            default_payment_method: paymentMethod.stripe_id,
          },
        })
        .catch(() => {
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
          id: Schema.ID.PAYMENT_METHOD.required(),
        }),
      },
    },
    handler: async (request, h) => {
      const [authenticatedUser] = Utilities.getAuthenticatedUser(request);

      const paymentMethod = await PaymentMethod.retrieve(request.params.id);

      if (paymentMethod.user.id !== authenticatedUser.id) {
        throw Boom.forbidden();
      }

      const defaultPaymentMethod = await PaymentMethod.retrieveDefaultForUser(
        authenticatedUser.id
      );

      /**
       * The default payment method cannot be deleted if
       * the user has at least one active subscription
       */
      if (
        defaultPaymentMethod?.id === paymentMethod.id &&
        (await authenticatedUser.hasActiveSubscriptions())
      ) {
        throw Boom.forbidden();
      }

      await Config.STRIPE.paymentMethods
        .detach(paymentMethod.stripe_id)
        .catch(() => {
          throw Boom.badImplementation();
        });

      return h.response();
    },
  },
];
