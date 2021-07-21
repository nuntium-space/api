import Boom from "@hapi/boom";
import { ServerRoute } from "@hapi/hapi";
import Joi from "joi";
import { Config } from "../../config/Config";
import { Schema } from "../../config/Schema";
import { Organization } from "../../models/Organization";
import { ORGANIZATION_SCHEMA } from "../../types/organization";
import Utilities from "../../utilities/Utilities";

export default <ServerRoute[]>[
  {
    method: "GET",
    path: "/organizations/{id}",
    options: {
      validate: {
        params: Joi.object({
          id: Schema.ID.ORGANIZATION.required(),
        }),
      },
      response: {
        schema: ORGANIZATION_SCHEMA.OBJ,
      },
    },
    handler: async (request, h) => {
      const organization = await Organization.retrieve(request.params.id);

      const [authenticatedUser] = Utilities.getAuthenticatedUser(request);

      if (organization.user.id !== authenticatedUser.id) {
        throw Boom.forbidden();
      }

      return organization.serialize({ for: authenticatedUser });
    },
  },
  {
    method: "GET",
    path: "/organizations/{id}/stripe/connect",
    options: {
      validate: {
        params: Joi.object({
          id: Schema.ID.ORGANIZATION.required(),
        }),
      },
    },
    handler: async (request, h) => {
      const organization = await Organization.retrieve(request.params.id);

      const [authenticatedUser] = Utilities.getAuthenticatedUser(request);

      if (organization.user.id !== authenticatedUser.id) {
        throw Boom.forbidden();
      }

      const { url } = await Config.STRIPE.accountLinks
        .create({
          account: organization.stripe_account_id,
          type: "account_onboarding",
          refresh_url: `${Config.API_URL}/organizations/${organization.id}/stripe/connect`,
          return_url: `${Config.CLIENT_URL}/organization/${organization.id}`,
        })
        .catch(() => {
          throw Boom.badImplementation();
        });

      return h.redirect(url);
    },
  },
  {
    method: "GET",
    path: "/organizations/{id}/stripe/dashboard",
    options: {
      validate: {
        params: Joi.object({
          id: Schema.ID.ORGANIZATION.required(),
        }),
      },
    },
    handler: async (request, h) => {
      const organization = await Organization.retrieve(request.params.id);

      const [authenticatedUser] = Utilities.getAuthenticatedUser(request);

      if (organization.user.id !== authenticatedUser.id) {
        throw Boom.forbidden();
      }

      const { url } = await Config.STRIPE.accounts
        .createLoginLink(organization.stripe_account_id)
        .catch(() => {
          throw Boom.badImplementation();
        });

      return h.redirect(url);
    },
  },
  {
    method: "GET",
    path: "/users/{id}/organizations",
    options: {
      validate: {
        params: Joi.object({
          id: Schema.ID.USER.required(),
        }),
      },
      response: {
        schema: Schema.ARRAY(ORGANIZATION_SCHEMA.OBJ).required(),
      },
    },
    handler: async (request, h) => {
      const [authenticatedUser] = Utilities.getAuthenticatedUser(request);

      if (request.params.id !== authenticatedUser.id) {
        throw Boom.forbidden();
      }

      const organizations = await Organization.forUser(authenticatedUser);

      return organizations.map((organization) =>
        organization.serialize({ for: authenticatedUser })
      );
    },
  },
  {
    method: "POST",
    path: "/organizations",
    options: {
      validate: {
        payload: ORGANIZATION_SCHEMA.CREATE,
      },
      response: {
        schema: Schema.NOT_EXPANDED_RESOURCE(Schema.ID.ORGANIZATION),
      },
    },
    handler: async (request, h) => {
      const [authenticatedUser] = Utilities.getAuthenticatedUser(request);

      return Organization.create(request.payload as any, authenticatedUser);
    },
  },
  {
    method: "PATCH",
    path: "/organizations/{id}",
    options: {
      validate: {
        params: Joi.object({
          id: Schema.ID.ORGANIZATION.required(),
        }),
        payload: ORGANIZATION_SCHEMA.UPDATE,
      },
      response: {
        schema: ORGANIZATION_SCHEMA.OBJ,
      },
    },
    handler: async (request, h) => {
      const organization = await Organization.retrieve(request.params.id);

      const [authenticatedUser] = Utilities.getAuthenticatedUser(request);

      if (organization.user.id !== authenticatedUser.id) {
        throw Boom.forbidden();
      }

      await organization.update(request.payload as any);

      return organization.serialize({ for: authenticatedUser });
    },
  },
  {
    method: "DELETE",
    path: "/organizations/{id}",
    options: {
      validate: {
        params: Joi.object({
          id: Schema.ID.ORGANIZATION.required(),
        }),
      },
    },
    handler: async (request, h) => {
      const organization = await Organization.retrieve(request.params.id);

      const [authenticatedUser] = Utilities.getAuthenticatedUser(request);

      if (organization.user.id !== authenticatedUser.id) {
        throw Boom.forbidden();
      }

      await organization.delete();

      return h.response();
    },
  },
];
