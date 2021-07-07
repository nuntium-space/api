import { ServerRoute } from "@hapi/hapi";
import Joi from "joi";
import { Schema } from "../../config/Schema";
import { ArticleReport } from "../../models/ArticleReport";
import { ARTICLE_REPORT_SCHEMA } from "../../types/article-report";
import Utilities from "../../utilities/Utilities";

export default <ServerRoute[]>[
  {
    method: "POST",
    path: "/articles/{id}/reports",
    options: {
      validate: {
        params: Joi.object({
          id: Schema.ID.ARTICLE.required(),
        }),
        payload: ARTICLE_REPORT_SCHEMA.CREATE,
      },
      response: {
        schema: Schema.NOT_EXPANDED_RESOURCE(Schema.ID.ARTICLE_REPORT),
      },
    },
    handler: async (request, h) => {
      const [authenticatedUser] = Utilities.getAuthenticatedUser(request);

      return ArticleReport.create({
        user: authenticatedUser.id,
        article: request.params.id,
        reason: (request.payload as any).reason,
      });
    },
  },
];
