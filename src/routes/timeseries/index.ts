import Boom from "@hapi/boom";
import { ServerRoute } from "@hapi/hapi";
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
          unique: Schema.BOOLEAN.default(false).optional(),
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
        !(await article.author.publisher.isOwnedByUser(authenticatedUser))
      ) {
        throw Boom.forbidden();
      }

      const { from, to, precision, unique } = request.query;

      const result = await Database.pool.query(
        `
        select date_trunc($4, "timestamp") as "segment", count(*) as "count"
        from ${
          unique
            ? `(select distinct on ("user") "article", "timestamp" from "article_views") as "_"`
            : `"article_views"`
        }
        where
          "article" = $1
          and
          "timestamp" between $2 and $3
        group by date_trunc($4, "timestamp")
        `,
        [article.id, from.toISOString(), to.toISOString(), precision]
      );

      return Utilities.fillTimeseriesDataGapsWithZeroCountValues(
        result.rows.map((_) => ({
          segment: _.segment.toISOString(),
          count: parseInt(_.count),
        })),
        from,
        to,
        precision
      );
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
          unique: Schema.BOOLEAN.default(false).optional(),
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

      if (!(await publisher.isOwnedByUser(authenticatedUser))) {
        throw Boom.forbidden();
      }

      const { from, to, precision, unique } = request.query;

      const result = await Database.pool.query(
        `
        select date_trunc($4, "avw"."timestamp") as "segment", count(*) as "count"
        from
          ${
            unique
              ? `(select distinct on ("user") "article", "timestamp" from "article_views") as "avw"`
              : `"article_views" as "avw"`
          }
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
        [from.toISOString(), to.toISOString(), publisher.id, precision]
      );

      return Utilities.fillTimeseriesDataGapsWithZeroCountValues(
        result.rows.map((_) => ({
          segment: _.segment.toISOString(),
          count: parseInt(_.count),
        })),
        from,
        to,
        precision
      );
    },
  },
];
