import Boom from "@hapi/boom";
import { ServerRoute } from "@hapi/hapi";
import Joi from "joi";
import { Schema } from "../../config/Schema";
import { Article } from "../../models/Article";
import { Like } from "../../models/Like";
import { LIKE_SCHEMA } from "../../types/like";
import Utilities from "../../utilities/Utilities";

export default <ServerRoute[]>[
  {
    method: "GET",
    path: "/users/{id}/likes",
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
        schema: Schema.ARRAY(LIKE_SCHEMA.OBJ),
      },
    },
    handler: async (request, h) => {
      const [authenticatedUser] = Utilities.getAuthenticatedUser(request);

      if (request.params.id !== authenticatedUser.id) {
        throw Boom.forbidden();
      }

      const likes = await Like.forUser(authenticatedUser, request.query.expand);

      return Promise.all(likes.map((_) => _.serialize()));
    },
  },
  {
    method: "POST",
    path: "/users/{id}/likes",
    options: {
      validate: {
        params: Joi.object({
          id: Schema.ID.USER.required(),
        }),
        query: Joi.object({
          expand: Schema.EXPAND_QUERY,
        }),
        payload: LIKE_SCHEMA.CREATE,
      },
    },
    handler: async (request, h) => {
      const [authenticatedUser] = Utilities.getAuthenticatedUser(request);

      if (request.params.id !== authenticatedUser.id) {
        throw Boom.forbidden();
      }

      const article = await Article.retrieve((request.payload as any).article);

      await Like.create(authenticatedUser, article);

      return h.response();
    },
  },
  {
    method: "DELETE",
    path: "/users/{id}/likes",
    options: {
      validate: {
        params: Joi.object({
          id: Schema.ID.USER.required(),
        }),
        payload: Joi.object({
          article: Schema.ID.ARTICLE.required(),
        }),
      },
    },
    handler: async (request, h) => {
      const [authenticatedUser] = Utilities.getAuthenticatedUser(request);

      if (request.params.id !== authenticatedUser.id) {
        throw Boom.forbidden();
      }

      const like = await Like.retrieveWithUserAndArticle(
        authenticatedUser,
        (request.payload as any).article
      );

      await like.delete();

      return h.response();
    },
  },
];
