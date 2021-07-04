import Boom from "@hapi/boom";
import { ServerRoute } from "@hapi/hapi";
import Joi from "joi";
import { Config } from "../../config/Config";
import { Schema } from "../../config/Schema";
import { Article } from "../../models/Article";
import { ARTICLE_SCHEMA } from "../../types/article";
import { USER_SCHEMA } from "../../types/user";
import Database from "../../utilities/Database";
import Utilities from "../../utilities/Utilities";

export default <ServerRoute[]>[
  {
    method: "GET",
    path: "/users/{id}",
    options: {
      validate: {
        params: Joi.object({
          id: Schema.ID.USER.required(),
        }),
      },
      response: {
        schema: USER_SCHEMA.OBJ,
      },
    },
    handler: async (request, h) => {
      const [authenticatedUser] = Utilities.getAuthenticatedUser(request);

      if (request.params.id !== authenticatedUser.id) {
        throw Boom.forbidden();
      }

      return authenticatedUser.serialize({ for: authenticatedUser });
    },
  },
  {
    method: "GET",
    path: "/users/{id}/history",
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
        schema: Schema.ARRAY(
          Joi.object({
            article: Joi.alternatives(
              ARTICLE_SCHEMA.OBJ,
              Schema.NOT_EXPANDED_RESOURCE(Schema.ID.ARTICLE)
            ).required(),
            last_viewed_at: Schema.DATETIME.required(),
          })
        ),
      },
    },
    handler: async (request, h) => {
      const [authenticatedUser] = Utilities.getAuthenticatedUser(request);

      if (request.params.id !== authenticatedUser.id) {
        throw Boom.forbidden();
      }

      const result = await Database.pool.query(
        `
                    select "article", "last_viewed_at"
                    from "user_history"
                    where "user" = $1
                    order by "last_viewed_at" desc
                    `,
        [authenticatedUser.id]
      );

      return Promise.all(
        result.rows.map(async (_) => {
          const article = request.query.expand?.includes("article")
            ? await Article.retrieve(
                _.article,
                Utilities.getNestedExpandQuery(request.query.expand, "article")
              )
            : { id: _.article };

          return {
            article:
              article instanceof Article ? await article.serialize() : article,
            last_viewed_at: _.last_viewed_at,
          };
        })
      );
    },
  },
  {
    method: "GET",
    path: "/users/{id}/settings",
    options: {
      validate: {
        params: Joi.object({
          id: Schema.ID.USER.required(),
        }),
      },
      response: {
        schema: Joi.object({
          language: Schema.NULLABLE(Schema.LANGUAGE).required(),
        }),
      },
    },
    handler: async (request, h) => {
      const [authenticatedUser] = Utilities.getAuthenticatedUser(request);

      if (request.params.id !== authenticatedUser.id) {
        throw Boom.forbidden();
      }

      return authenticatedUser.retrieveSettings();
    },
  },
  {
    method: "GET",
    path: "/users/{id}/stripe/portal",
    options: {
      validate: {
        params: Joi.object({
          id: Schema.ID.USER.required(),
        }),
      },
      response: {
        schema: Joi.object({
          url: Schema.URL.required(),
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

      const { url } = await Config.STRIPE.billingPortal.sessions
        .create({
          customer: authenticatedUser.stripe_customer_id,
        })
        .catch(() => {
          throw Boom.badImplementation();
        });

      return { url };
    },
  },
  {
    method: "PATCH",
    path: "/users/{id}",
    options: {
      validate: {
        params: Joi.object({
          id: Schema.ID.USER.required(),
        }),
        payload: USER_SCHEMA.UPDATE,
      },
      response: {
        schema: USER_SCHEMA.OBJ,
      },
    },
    handler: async (request, h) => {
      const [authenticatedUser] = Utilities.getAuthenticatedUser(request);

      if (request.params.id !== authenticatedUser.id) {
        throw Boom.forbidden();
      }

      await authenticatedUser.update(request.payload as any);

      return authenticatedUser.serialize({ for: authenticatedUser });
    },
  },
  {
    method: "PATCH",
    path: "/users/{id}/settings",
    options: {
      validate: {
        params: Joi.object({
          id: Schema.ID.USER.required(),
        }),
        payload: Joi.object({
          language: Schema.LANGUAGE,
        }),
      },
    },
    handler: async (request, h) => {
      const [authenticatedUser] = Utilities.getAuthenticatedUser(request);

      if (request.params.id !== authenticatedUser.id) {
        throw Boom.forbidden();
      }

      await authenticatedUser.updateSettings(request.payload as any);

      return h.response();
    },
  },
  {
    method: "DELETE",
    path: "/users/{id}",
    options: {
      validate: {
        params: Joi.object({
          id: Schema.ID.USER.required(),
        }),
      },
    },
    handler: async (request, h) => {
      const [authenticatedUser] = Utilities.getAuthenticatedUser(request);

      if (request.params.id !== authenticatedUser.id) {
        throw Boom.forbidden();
      }

      await authenticatedUser.delete();

      return h.response();
    },
  },
  {
    method: "DELETE",
    path: "/users/{id}/history",
    options: {
      validate: {
        params: Joi.object({
          id: Schema.ID.USER.required(),
        }),
      },
    },
    handler: async (request, h) => {
      const [authenticatedUser] = Utilities.getAuthenticatedUser(request);

      if (request.params.id !== authenticatedUser.id) {
        throw Boom.forbidden();
      }

      await Database.pool.query(
        `
                    delete from "user_history"
                    where "user" = $1
                    `,
        [authenticatedUser.id]
      );

      return h.response();
    },
  },
];
