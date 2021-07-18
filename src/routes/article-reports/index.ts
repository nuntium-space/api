import Boom from "@hapi/boom";
import { ServerRoute } from "@hapi/hapi";
import Joi from "joi";
import { Schema } from "../../config/Schema";
import { Article } from "../../models/Article";
import { ArticleReport } from "../../models/ArticleReport";
import { Author } from "../../models/Author";
import { Publisher } from "../../models/Publisher";
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

      const article = await Article.retrieve(request.params.id, [
        "author",
        "author.publisher",
      ]);

      if (
        !(article.author instanceof Author) ||
        !(article.author.publisher instanceof Publisher)
      ) {
        throw Boom.badImplementation();
      }

      if (
        !(await authenticatedUser.isSubscribedToPublisher(
          article.author.publisher
        ))
      ) {
        throw Boom.paymentRequired();
      }

      return ArticleReport.create({
        user: authenticatedUser.id,
        article: article.id,
        reason: (request.payload as any).reason,
      });
    },
  },
];
