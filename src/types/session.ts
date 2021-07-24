import Joi from "joi";
import { INotExpandedResource } from "../common/INotExpandedResource";
import { ModelKind } from "../config/Model";
import { Schema } from "../config/Schema";
import { Session } from "../models/Session";
import { User } from "../models/User";
import { USER_MODEL, USER_SCHEMA } from "./user";

export interface ISession {
  id: string;
  user: User | INotExpandedResource;
  expires_at: Date;
}

export interface IDatabaseSession {
  id: string;
  user: string;
  expires_at: Date;
}

export const SESSION_MODEL: ModelKind = {
  table: "sessions",
  keys: [["id"]],
  expand: [
    {
      field: "user",
      model: USER_MODEL,
    },
  ],
  fields: ["id", "user", "expires_at"],
  getModel: () => Session,
  getInstance: (data) => new Session(data),
};

export const SESSION_SCHEMA = {
  OBJ: Joi.object({
    id: Schema.ID.SESSION.required(),
    user: Joi.alternatives(
      USER_SCHEMA.OBJ,
      Schema.NOT_EXPANDED_RESOURCE(Schema.ID.USER)
    ).required(),
    expires_at: Schema.DATETIME.required(),
  }),
  CREATE: Joi.object({
    email: Schema.EMAIL.required(),
  }),
} as const;
