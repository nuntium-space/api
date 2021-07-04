import { promises as dns } from "dns";
import Boom from "@hapi/boom";
import { ServerRoute } from "@hapi/hapi";
import Joi from "joi";
import { Config } from "../../config/Config";
import { Bundle } from "../../models/Bundle";
import { Organization } from "../../models/Organization";
import { Publisher } from "../../models/Publisher";
import Database from "../../utilities/Database";
import { Schema } from "../../config/Schema";
import { PUBLISHER_SCHEMA } from "../../types/publisher";
import Utilities from "../../utilities/Utilities";

export default <ServerRoute[]>[
  {
    method: "GET",
    path: "/publishers/{id}",
    options: {
      validate: {
        params: Joi.object({
          id: Schema.ID.PUBLISHER.required(),
        }),
      },
      response: {
        schema: PUBLISHER_SCHEMA.OBJ,
      },
    },
    handler: async (request, h) => {
      const [authenticatedUser] = Utilities.getAuthenticatedUser(request);

      const publisher = await Publisher.retrieve(request.params.id);

      return {
        ...publisher.serialize({ for: authenticatedUser }),
        __metadata: {
          is_author: await authenticatedUser.isAuthorOfPublisher(publisher),
          is_subscribed: await authenticatedUser.isSubscribedToPublisher(
            publisher
          ),
        },
      };
    },
  },
  {
    method: "GET",
    path: "/publishers/{id}/verification/data",
    options: {
      validate: {
        params: Joi.object({
          id: Schema.ID.PUBLISHER.required(),
        }),
      },
      response: {
        schema: Joi.object({
          dns: Joi.object({
            record: Schema.STRING.required(),
          }).required(),
        }),
      },
    },
    handler: async (request, h) => {
      const [authenticatedUser] = Utilities.getAuthenticatedUser(request);

      const publisher = await Publisher.retrieve(request.params.id);

      if (!publisher.isOwnedByUser(authenticatedUser)) {
        throw Boom.forbidden();
      }

      return {
        dns: {
          record: `${Config.DOMAIN_VERIFICATION_DNS_TXT_RECORD_PREFIX}=${publisher.dns_txt_value}`,
        },
      };
    },
  },
  {
    method: "GET",
    path: "/bundles/{id}/publishers",
    options: {
      validate: {
        params: Joi.object({
          id: Schema.ID.BUNDLE.required(),
        }),
      },
      response: {
        schema: Schema.ARRAY(PUBLISHER_SCHEMA.OBJ).required(),
      },
    },
    handler: async (request, h) => {
      const [authenticatedUser] = Utilities.getAuthenticatedUser(request);

      const bundle = await Bundle.retrieve(request.params.id);

      const publishers = await Publisher.forBundle(bundle);

      return publishers.map((publisher) =>
        publisher.serialize({ for: authenticatedUser })
      );
    },
  },
  {
    method: "GET",
    path: "/organizations/{id}/publishers",
    options: {
      validate: {
        params: Joi.object({
          id: Schema.ID.ORGANIZATION.required(),
        }),
        query: Joi.object({
          not_in_bundle: Schema.ID.BUNDLE,
        }),
      },
      response: {
        schema: Schema.ARRAY(PUBLISHER_SCHEMA.OBJ).required(),
      },
    },
    handler: async (request, h) => {
      const organization = await Organization.retrieve(request.params.id);

      const [authenticatedUser] = Utilities.getAuthenticatedUser(request);

      if (organization.owner.id !== authenticatedUser.id) {
        throw Boom.forbidden();
      }

      const publishers = await Publisher.forOrganization(organization, {
        not_in_bundle: request.query.not_in_bundle,
      });

      return publishers.map((publisher) =>
        publisher.serialize({ for: authenticatedUser })
      );
    },
  },
  {
    method: ["POST", "DELETE"],
    path: "/bundles/{bundle_id}/publishers/{publisher_id}",
    options: {
      validate: {
        params: Joi.object({
          bundle_id: Schema.ID.BUNDLE.required(),
          publisher_id: Schema.ID.PUBLISHER.required(),
        }),
      },
    },
    handler: async (request, h) => {
      const bundle = await Bundle.retrieve(request.params.bundle_id, [
        "organization",
      ]);

      if (!(bundle.organization instanceof Organization)) {
        throw Boom.badImplementation();
      }

      const [authenticatedUser] = Utilities.getAuthenticatedUser(request);

      if (bundle.organization.owner.id !== authenticatedUser.id) {
        throw Boom.forbidden();
      }

      const publisher = await Publisher.retrieve(request.params.publisher_id);

      if (!publisher.isOwnedByUser(authenticatedUser)) {
        throw Boom.badImplementation();
      }

      switch (request.method) {
        case "delete": {
          await bundle.removePublisher(publisher);

          break;
        }
        case "post": {
          await bundle.addPublisher(publisher);

          break;
        }
      }

      return h.response();
    },
  },
  {
    method: "POST",
    path: "/organizations/{id}/publishers",
    options: {
      validate: {
        payload: PUBLISHER_SCHEMA.CREATE,
      },
      response: {
        schema: Schema.NOT_EXPANDED_RESOURCE(Schema.ID.PUBLISHER),
      },
    },
    handler: async (request, h) => {
      const organization = await Organization.retrieve(request.params.id);

      const [authenticatedUser] = Utilities.getAuthenticatedUser(request);

      if (organization.owner.id !== authenticatedUser.id) {
        throw Boom.forbidden();
      }

      return Publisher.create(request.payload as any, organization);
    },
  },
  {
    method: "POST",
    path: "/publishers/{id}/verify",
    handler: async (request, h) => {
      const [authenticatedUser] = Utilities.getAuthenticatedUser(request);

      const publisher = await Publisher.retrieve(request.params.id);

      if (!publisher.isOwnedByUser(authenticatedUser)) {
        throw Boom.forbidden();
      }

      const result = await dns
        .resolveTxt(new URL(publisher.url).hostname)
        .catch(() => {
          throw Boom.badImplementation();
        });

      const domainVerificationId = result
        .find((record) =>
          record[0].startsWith(Config.DOMAIN_VERIFICATION_DNS_TXT_RECORD_PREFIX)
        )?.[0]
        .split("=")[1];

      if (!domainVerificationId) {
        throw Boom.badRequest(undefined, [
          {
            field: "url",
            error: `Could not verify domain '${publisher.url}'`,
          },
        ]);
      }

      if (domainVerificationId !== publisher.dns_txt_value) {
        throw Boom.badRequest(undefined, [
          {
            field: "publisher",
            error: `TXT Record for '${publisher.url}' does not match the expected value`,
          },
        ]);
      }

      await Database.pool
        .query(`update "publishers" set "verified" = $1 where "id" = $2`, [
          true,
          publisher.id,
        ])
        .catch(() => {
          throw Boom.badImplementation();
        });

      return h.response();
    },
  },
  {
    method: "PATCH",
    path: "/publishers/{id}",
    options: {
      validate: {
        params: Joi.object({
          id: Schema.ID.PUBLISHER.required(),
        }),
        payload: PUBLISHER_SCHEMA.UPDATE,
      },
      response: {
        schema: PUBLISHER_SCHEMA.OBJ,
      },
    },
    handler: async (request, h) => {
      const publisher = await Publisher.retrieve(request.params.id);

      const [authenticatedUser] = Utilities.getAuthenticatedUser(request);

      if (!publisher.isOwnedByUser(authenticatedUser)) {
        throw Boom.forbidden();
      }

      await publisher.update(request.payload as any);

      return publisher.serialize({ for: authenticatedUser });
    },
  },
  {
    method: "PUT",
    path: "/publishers/{id}/image",
    options: {
      payload: {
        allow: "multipart/form-data",
        multipart: true,
        maxBytes: Config.PUBLISHER_IMAGE_MAX_SIZE,
      },
      validate: {
        params: Joi.object({
          id: Schema.ID.PUBLISHER.required(),
        }),
        payload: Joi.object({
          image: Joi.binary().required(),
        }),
      },
      response: {
        schema: Joi.object({
          url: Schema.STRING.required(),
        }),
      },
    },
    handler: async (request, h) => {
      const publisher = await Publisher.retrieve(request.params.id);

      const [authenticatedUser] = Utilities.getAuthenticatedUser(request);

      if (!publisher.isOwnedByUser(authenticatedUser)) {
        throw Boom.forbidden();
      }

      const { image } = request.payload as any;

      return publisher.setImage(image);
    },
  },
  {
    method: "DELETE",
    path: "/publishers/{id}",
    options: {
      validate: {
        params: Joi.object({
          id: Schema.ID.PUBLISHER.required(),
        }),
      },
    },
    handler: async (request, h) => {
      const publisher = await Publisher.retrieve(request.params.id);

      const [authenticatedUser] = Utilities.getAuthenticatedUser(request);

      if (!publisher.isOwnedByUser(authenticatedUser)) {
        throw Boom.forbidden();
      }

      await publisher.delete();

      return h.response();
    },
  },
];
