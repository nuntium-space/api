import { ServerRoute } from "@hapi/hapi";
import Joi from "joi";
import { Schema } from "../../config/Schema";
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
      },
    },
    handler: async (request, h) => {
      const [authenticatedUser] = Utilities.getAuthenticatedUser(request);

      // TODO

      return h.response();
    },
  },
];
