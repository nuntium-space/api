import { ServerRoute } from "@hapi/hapi";
import Joi from "joi";
import { Schema } from "../../../config/Schema";
import { ArticleReport } from "../../../models/ArticleReport";
import { ARTICLE_REPORT_SCHEMA } from "../../../types/article-report";

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
        schema: Schema.ARRAY(ARTICLE_REPORT_SCHEMA.OBJ),
      },
    },
    handler: (request, h) => {
      return ArticleReport.list(request.query.expand);
    },
  },
];
