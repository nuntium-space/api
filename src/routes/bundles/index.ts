import Boom from "@hapi/boom";
import { ServerRoute } from "@hapi/hapi";
import Joi from "joi";
import { Schema } from "../../config/Schema";
import { Bundle } from "../../models/Bundle";
import { Organization } from "../../models/Organization";
import { Publisher } from "../../models/Publisher";
import { BUNDLE_SCHEMA } from "../../types/bundle";
import Utilities from "../../utilities/Utilities";

export default <ServerRoute[]>[
  {
    method: "GET",
    path: "/bundles/{id}",
    options: {
      validate: {
        params: Joi.object({
          id: Schema.ID.BUNDLE.required(),
        }),
        query: Joi.object({
          expand: Schema.EXPAND_QUERY,
        }),
      },
      response: {
        schema: BUNDLE_SCHEMA.OBJ,
      },
    },
    handler: async (request, h) => {
      const [authenticatedUser] = Utilities.getAuthenticatedUser(request);

      const bundle = await Bundle.retrieve(
        request.params.id,
        request.query.expand
      );

      return bundle.serialize({ for: authenticatedUser });
    },
  },
  {
    method: "GET",
    path: "/organizations/{id}/bundles",
    options: {
      validate: {
        params: Joi.object({
          id: Schema.ID.ORGANIZATION.required(),
        }),
        query: Joi.object({
          expand: Schema.EXPAND_QUERY,
        }),
      },
      response: {
        schema: Schema.ARRAY(BUNDLE_SCHEMA.OBJ).required(),
      },
    },
    handler: async (request, h) => {
      const organization = await Organization.retrieve(request.params.id);

      const [authenticatedUser] = Utilities.getAuthenticatedUser(request);

      if (organization.owner.id !== authenticatedUser.id) {
        throw Boom.forbidden();
      }

      const bundles = await Bundle.forOrganization(
        organization,
        request.query.expand
      );

      return bundles.map((bundle) =>
        bundle.serialize({ for: authenticatedUser })
      );
    },
  },
  {
    method: "GET",
    path: "/publishers/{id}/bundles",
    options: {
      validate: {
        params: Joi.object({
          id: Schema.ID.PUBLISHER.required(),
        }),
        query: Joi.object({
          expand: Schema.EXPAND_QUERY,
        }),
      },
      response: {
        schema: Schema.ARRAY(BUNDLE_SCHEMA.OBJ).required(),
      },
    },
    handler: async (request, h) => {
      const [authenticatedUser] = Utilities.getAuthenticatedUser(request);

      const publisher = await Publisher.retrieve(request.params.id);

      const bundles = await Bundle.forPublisher(
        publisher,
        request.query.expand
      );

      return bundles.map((bundle) =>
        bundle.serialize({ for: authenticatedUser })
      );
    },
  },
  {
    method: "POST",
    path: "/organizations/{id}/bundles",
    options: {
      validate: {
        params: Joi.object({
          id: Schema.ID.ORGANIZATION.required(),
        }),
        query: Joi.object({
          expand: Schema.EXPAND_QUERY,
        }),
        payload: BUNDLE_SCHEMA.CREATE,
      },
      response: {
        schema: Schema.NOT_EXPANDED_RESOURCE(Schema.ID.BUNDLE),
      },
    },
    handler: async (request, h) => {
      const organization = await Organization.retrieve(request.params.id);

      const [authenticatedUser] = Utilities.getAuthenticatedUser(request);

      if (organization.owner.id !== authenticatedUser.id) {
        throw Boom.forbidden();
      }

      return Bundle.create(request.payload as any, organization);
    },
  },
  {
    method: "PATCH",
    path: "/bundles/{id}",
    options: {
      validate: {
        params: Joi.object({
          id: Schema.ID.BUNDLE.required(),
        }),
        payload: BUNDLE_SCHEMA.UPDATE,
      },
      response: {
        schema: BUNDLE_SCHEMA.OBJ,
      },
    },
    handler: async (request, h) => {
      const bundle = await Bundle.retrieve(request.params.id, ["organization"]);

      if (!(bundle.organization instanceof Organization)) {
        throw Boom.badImplementation();
      }

      const [authenticatedUser] = Utilities.getAuthenticatedUser(request);

      if (bundle.organization.owner.id !== authenticatedUser.id) {
        throw Boom.forbidden();
      }

      await bundle.update(request.payload as any);

      return bundle.serialize({ for: authenticatedUser });
    },
  },
];
