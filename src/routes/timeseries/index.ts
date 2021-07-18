import Boom from "@hapi/boom";
import { ServerRoute } from "@hapi/hapi";
import { addDays, addHours, differenceInDays, differenceInHours } from "date-fns";
import Joi from "joi";
import { Schema } from "../../config/Schema";
import { Article } from "../../models/Article";
import { Author } from "../../models/Author";
import { Publisher } from "../../models/Publisher";
import Database from "../../utilities/Database";
import Utilities from "../../utilities/Utilities";

export default <ServerRoute[]>[
  {
    method: "GET",
    path: "/articles/{id}/timeseries/views",
    options: {
      validate: {
        params: Joi.object({
          id: Schema.ID.ARTICLE.required(),
        }),
        query: Joi.object({
          from: Schema.DATETIME.required(),
          to: Schema.DATETIME.min(Joi.ref("from")).max("now").required(),
          precision: Schema.STRING.valid("day", "hour").required(),
        }),
      },
      response: {
        schema: Schema.ARRAY(
          Joi.object({
            segment: Schema.DATETIME.required(),
            count: Joi.number().min(0).required(),
          })
        ),
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
        authenticatedUser.id !== article.author.user.id &&
        !article.author.publisher.isOwnedByUser(authenticatedUser)
      ) {
        throw Boom.forbidden();
      }

      const from = request.query.from as Date;
      const to = request.query.to as Date;
      const precision = request.query.precision as "day" | "hour";

      const result = await Database.pool.query(
        `
        select date_trunc($4, "timestamp") as "segment", count(*) as "count"
        from "article_views"
        where
          "article" = $1
          and
          "timestamp" between $2 and $3
        group by date_trunc($4, "timestamp")
        `,
        [
          article.id,
          from.toISOString(),
          to.toISOString(),
          precision,
        ]
      );

      const dataPointsWithValues = result.rows.map((_) => ({
        segment: _.segment.toISOString(),
        count: parseInt(_.count),
      }));

      if (precision === "day")
      {
        let date = from;

        for (let i = 0; i <= differenceInDays(to, from); i++)
        {
          date = addDays(from, i);

          if (!dataPointsWithValues.find(_ => _.segment.startsWith(`${date.toISOString().split("T")[0]}T`)))
          {
            dataPointsWithValues.push({
              segment: `${date.toISOString().split("T")[0]}T00:00:00.000Z`,
              count: 0,
            });
          }
        }
      }

      return dataPointsWithValues.sort((a, b) => new Date(a.segment).getTime() - new Date(b.segment).getTime());
    },
  },
  {
    method: "GET",
    path: "/publishers/{id}/timeseries/views",
    options: {
      validate: {
        params: Joi.object({
          id: Schema.ID.PUBLISHER.required(),
        }),
        query: Joi.object({
          from: Schema.DATETIME.required(),
          to: Schema.DATETIME.min(Joi.ref("from")).max("now").required(),
          precision: Schema.STRING.valid("day", "hour").required(),
        }),
      },
      response: {
        schema: Schema.ARRAY(
          Joi.object({
            segment: Schema.DATETIME.required(),
            count: Joi.number().min(0).required(),
          })
        ),
      },
    },
    handler: async (request, h) => {
      const [authenticatedUser] = Utilities.getAuthenticatedUser(request);

      const publisher = await Publisher.retrieve(request.params.id);

      if (!publisher.isOwnedByUser(authenticatedUser)) {
        throw Boom.forbidden();
      }

      const result = await Database.pool.query(
        `
        select date_trunc($4, "avw"."timestamp") as "segment", count(*) as "count"
        from
          "article_views" as "avw"
          inner join
          "articles" as "art"
          on "avw"."article" = "art"."id"
          inner join
          "authors" as "aut"
          on "art"."author" = "aut"."id"
        where
          "avw"."timestamp" between $1 and $2
          and
          "aut"."publisher" = $3
        group by date_trunc($4, "avw"."timestamp")
        `,
        [
          request.query.from.toISOString(),
          request.query.to.toISOString(),
          publisher.id,
          request.query.precision,
        ]
      );

      return result.rows.map((_) => ({
        segment: _.segment.toISOString(),
        count: parseInt(_.count),
      }));
    },
  },
];
