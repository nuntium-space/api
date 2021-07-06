import Boom from "@hapi/boom";
import { ServerRoute } from "@hapi/hapi";
import Joi from "joi";
import { Schema } from "../../config/Schema";
import { Subscription } from "../../models/Subscription";
import { SUBSCRIPTION_SCHEMA } from "../../types/subscription";
import Utilities from "../../utilities/Utilities";

export default <ServerRoute[]>[
  {
    method: "GET",
    path: "/users/{id}/subscriptions",
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
        schema: Schema.ARRAY(SUBSCRIPTION_SCHEMA.OBJ).required(),
      },
    },
    handler: async (request, h) => {
      const [authenticatedUser] = Utilities.getAuthenticatedUser(request);

      if (request.params.id !== authenticatedUser.id) {
        throw Boom.forbidden();
      }

      const subscriptions = await Subscription.forUser(
        authenticatedUser,
        request.query.expand
      );

      return subscriptions.map((subscription) =>
        subscription.serialize({ for: authenticatedUser })
      );
    },
  },
];
