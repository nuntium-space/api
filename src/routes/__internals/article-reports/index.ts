import { ServerRoute } from "@hapi/hapi";
import Joi from "joi";
import { Schema } from "../../../config/Schema";
import { ARTICLE_DRAFT_SCHEMA } from "../../../types/article-draft";

export default <ServerRoute[]>[
  {
    method: "GET",
    path: "/articles/reports",
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
      // TODO
    },
  },
];
