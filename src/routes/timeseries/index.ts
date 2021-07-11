import Boom from "@hapi/boom";
import { ServerRoute } from "@hapi/hapi";
import Joi from "joi";
import { Schema } from "../../config/Schema";
import { Publisher } from "../../models/Publisher";
import Database from "../../utilities/Database";
import Utilities from "../../utilities/Utilities";

export default <ServerRoute[]>[
  {
    method: "GET",
    path: "/publishers/{id}/timeseries/views",
    options: {
      validate: {
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
