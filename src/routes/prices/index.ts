import Boom from "@hapi/boom";
import { ServerRoute } from "@hapi/hapi";
import Joi from "joi";
import type Stripe from "stripe";
import { Config } from "../../config/Config";
import { Schema } from "../../config/Schema";
import { Bundle } from "../../models/Bundle";
import { Organization } from "../../models/Organization";
import { Price } from "../../models/Price";
import { PRICE_SCHEMA } from "../../types/price";
import Utilities from "../../utilities/Utilities";

export default <ServerRoute[]>[
  {
    method: "GET",
    path: "/prices/{id}",
    options: {
      validate: {
        params: Joi.object({
          id: Schema.ID.PRICE.required(),
        }),
        query: Joi.object({
          expand: Schema.EXPAND_QUERY,
        }),
      },
      response: {
        schema: PRICE_SCHEMA.OBJ,
      },
    },
    handler: async (request, h) => {
      const [authenticatedUser] = Utilities.getAuthenticatedUser(request);

      const price = await Price.retrieve(
        request.params.id,
        request.query.expand
      );

      return price.serialize({ for: authenticatedUser });
    },
  },
  {
    method: "GET",
    path: "/prices/{id}/checkout",
    options: {
      validate: {
        params: Joi.object({
          id: Schema.ID.PRICE.required(),
        }),
      },
    },
    handler: async (request, h) => {
      const [authenticatedUser] = Utilities.getAuthenticatedUser(request);

      if (!authenticatedUser.stripe_customer_id) {
        throw Boom.badImplementation();
      }

      const price = await Price.retrieve(request.params.id, [
        "bundle",
        "bundle.organization",
      ]);

      if (
        !price.stripe_price_id ||
        !(price.bundle instanceof Bundle) ||
        !(price.bundle.organization instanceof Organization)
      ) {
        throw Boom.badImplementation();
      }

      if (!price.bundle.organization.stripe_account_enabled) {
        throw Boom.badRequest(undefined, [
          {
            field: "subscription",
            error: `The organization that owns the bundle '${price.bundle.id}' hasn't enabled payments`,
          },
        ]);
      }

      if (!(await authenticatedUser.canSubscribeToBundle(price.bundle))) {
        throw Boom.conflict(undefined, [
          {
            field: "subscription",
            error: `The user '${authenticatedUser.id}' is already subscribed to the bundle '${price.bundle.id}'`,
          },
        ]);
      }

      if (!price.active) {
        throw Boom.forbidden(undefined, [
          {
            field: "subscription",
            error: `The price '${price.id}' is not active`,
          },
        ]);
      }

      if (!price.bundle.active) {
        throw Boom.forbidden(undefined, [
          {
            field: "subscription",
            error: `The bundle '${price.bundle.id}' is not active`,
          },
        ]);
      }

      const userSettings = await authenticatedUser.retrieveSettings();

      const { url } = await Config.STRIPE.checkout.sessions
        .create({
          mode: "subscription",
          payment_method_types: ["card"],
          locale:
            (userSettings.language as Stripe.Checkout.SessionCreateParams.Locale) ??
            "en",
          success_url: Config.CLIENT_URL,
          cancel_url: `${Config.CLIENT_URL}/bundle/${price.bundle.id}/subscribe`,
          customer: authenticatedUser.stripe_customer_id,
          customer_update: {
            address: "auto",
          },
          automatic_tax: {
            enabled: true,
          },
          line_items: [
            {
              price: price.stripe_price_id,
              quantity: 1,
            },
          ],
          subscription_data: {
            application_fee_percent: Config.STRIPE_CONNECT_FEE_PERCENT,
            transfer_data: {
              destination: price.bundle.organization.stripe_account_id,
            },
            metadata: {
              user_id: authenticatedUser.id,
              price_id: price.id,
            },
          },
          metadata: {
            user_id: authenticatedUser.id,
            price_id: price.id,
          },
        })
        .catch(async () => {
          throw Boom.badRequest();
        });

      if (!url) {
        throw Boom.badImplementation();
      }

      return h.redirect(url);
    },
  },
  {
    method: "GET",
    path: "/bundles/{id}/prices",
    options: {
      validate: {
        params: Joi.object({
          id: Schema.ID.BUNDLE.required(),
        }),
        query: Joi.object({
          active: Schema.BOOLEAN,
          expand: Schema.EXPAND_QUERY,
        }),
      },
      response: {
        schema: Schema.ARRAY(PRICE_SCHEMA.OBJ).required(),
      },
    },
    handler: async (request, h) => {
      const [authenticatedUser] = Utilities.getAuthenticatedUser(request);

      const bundle = await Bundle.retrieve(request.params.id);

      const prices = await Price.forBundle(bundle, {
        active: request.query.active,
        expand: request.query.expand,
      });

      return prices.map((price) => price.serialize({ for: authenticatedUser }));
    },
  },
  {
    method: "POST",
    path: "/bundles/{id}/prices",
    options: {
      validate: {
        params: Joi.object({
          id: Schema.ID.BUNDLE.required(),
        }),
        query: Joi.object({
          expand: Schema.EXPAND_QUERY,
        }),
        payload: PRICE_SCHEMA.CREATE,
      },
      response: {
        schema: Schema.NOT_EXPANDED_RESOURCE(Schema.ID.PRICE),
      },
    },
    handler: async (request, h) => {
      const [authenticatedUser] = Utilities.getAuthenticatedUser(request);

      const bundle = await Bundle.retrieve(request.params.id, ["organization"]);

      if (!(bundle.organization instanceof Organization)) {
        throw Boom.badImplementation();
      }

      if (bundle.organization.owner.id !== authenticatedUser.id) {
        throw Boom.forbidden();
      }

      return Price.create(request.payload as any, bundle);
    },
  },
  {
    method: "PATCH",
    path: "/prices/{id}",
    options: {
      validate: {
        params: Joi.object({
          id: Schema.ID.PRICE.required(),
        }),
        payload: PRICE_SCHEMA.UPDATE,
      },
      response: {
        schema: PRICE_SCHEMA.OBJ,
      },
    },
    handler: async (request, h) => {
      const [authenticatedUser] = Utilities.getAuthenticatedUser(request);

      const price = await Price.retrieve(request.params.id, [
        "bundle",
        "bundle.organization",
      ]);

      if (
        !(price.bundle instanceof Bundle) ||
        !(price.bundle.organization instanceof Organization)
      ) {
        throw Boom.badImplementation();
      }

      if (price.bundle.organization.owner.id !== authenticatedUser.id) {
        throw Boom.forbidden();
      }

      await price.update(request.payload as any);

      return price.serialize({ for: authenticatedUser });
    },
  },
];
