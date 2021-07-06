import Boom from "@hapi/boom";
import { ServerRoute } from "@hapi/hapi";
import Joi from "joi";
import { Config } from "../../../config/Config";
import { Schema } from "../../../config/Schema";
import { ArticleDraft } from "../../../models/ArticleDraft";
import { Author } from "../../../models/Author";
import { Publisher } from "../../../models/Publisher";
import { User } from "../../../models/User";
import { ARTICLE_DRAFT_SCHEMA } from "../../../types/article-draft";
import { Email } from "../../../utilities/Email";

export default <ServerRoute[]>[
  {
    method: "GET",
    path: "/articles/drafts/submitted",
    options: {
      validate: {
        query: Joi.object({
          expand: Schema.EXPAND_QUERY,
        }),
      },
      response: {
        schema: Schema.ARRAY(ARTICLE_DRAFT_SCHEMA.OBJ),
      },
    },
    handler: async (request, h) => {
      const drafts = await ArticleDraft.listSubmitted(request.query.expand);

      return Promise.all(drafts.map((_) => _.serialize()));
    },
  },
  {
    method: "POST",
    path: "/articles/drafts/{id}/publish",
    options: {
      validate: {
        params: Joi.object({
          id: Schema.ID.ARTICLE_DRAFT.required(),
        }),
      },
    },
    handler: async (request, h) => {
      const draft = await ArticleDraft.retrieve(request.params.id, [
        "author",
        "author.user",
        "author.publisher",
      ]);

      if (
        !(draft.author instanceof Author) ||
        !(draft.author.user instanceof User) ||
        !(draft.author.publisher instanceof Publisher) ||
        !draft.author.user.full_name
      ) {
        throw Boom.badImplementation();
      }

      const { id } = await draft.publish();

      await Email.send({
        to: draft.author.user,
        type: Email.TYPE.ARTICLE_DRAFT_PUBLISHED,
        replace: {
          ARTICLE_DRAFT_TITLE: draft.title,
          AUTHOR_NAME: draft.author.user.full_name,
          PUBLISHER_NAME: draft.author.publisher.name,
          CLIENT_URL: Config.CLIENT_URL,
          ARTICLE_DRAFT_ID: id,
        },
      });

      return h.response();
    },
  },
  {
    method: "POST",
    path: "/articles/drafts/{id}/reject",
    options: {
      validate: {
        params: Joi.object({
          id: Schema.ID.ARTICLE_DRAFT.required(),
        }),
        payload: Joi.object({
          reason: Schema.STRING.min(1).required(),
        }),
      },
    },
    handler: async (request, h) => {
      const draft = await ArticleDraft.retrieve(request.params.id, [
        "author",
        "author.user",
        "author.publisher",
      ]);

      if (
        !(draft.author instanceof Author) ||
        !(draft.author.user instanceof User) ||
        !(draft.author.publisher instanceof Publisher) ||
        !draft.author.user.full_name
      ) {
        throw Boom.badImplementation();
      }

      const { reason } = request.payload as any;

      await draft.reject(reason);

      await Email.send({
        to: draft.author.user,
        type: Email.TYPE.ARTICLE_DRAFT_REJECTED,
        replace: {
          ARTICLE_DRAFT_TITLE: draft.title,
          AUTHOR_NAME: draft.author.user.full_name,
          PUBLISHER_NAME: draft.author.publisher.name,
          REASON: reason,
          CLIENT_URL: Config.CLIENT_URL,
          ARTICLE_DRAFT_ID: draft.id,
        },
      });

      return h.response();
    },
  },
];
