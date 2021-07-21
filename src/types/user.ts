import Joi from "joi";
import { Model, ModelKind } from "../config/Model";
import { Schema } from "../config/Schema";
import { User } from "../models/User";

export type UserType = "admin" | "user";

export interface IDatabaseUser {
  id: string;
  type: UserType;
  full_name: string | null;
  email: string;
  stripe_customer_id: string | null;
}

export interface ICreateUser {
  full_name?: string;
  email: string;
}

export interface IUpdateUser {
  full_name?: string;
  email?: string;
}

export interface IUserSettings {
  language: string | null;
}

export interface IUpdateUserSettings {
  language?: string;
}

export interface ISerializedUser {
  id: string;
  type: UserType;
  full_name: string | null;
  email: string;
  imageUrl: string;
}

export const USER_MODEL: ModelKind = {
  table: "accounts",
  keys: [["id"], ["email"], ["stripe_customer_id"]],
  expand: [],
  fields: ["id", "type", "full_name", "email", "stripe_customer_id"],
  getModel: () => User,
  getInstance: (data) => new User(data) as unknown as Model, // TODO: Remove once User is an actual Model
};

export const USER_SCHEMA = {
  OBJ: Joi.object({
    id: Schema.ID.USER.required(),
    type: Schema.STRING.valid("admin", "user").optional(), // Not included if sent to another user
    full_name: Schema.NULLABLE(Schema.STRING).required(),
    email: Schema.EMAIL.optional(), // Not included if sent to another user
    imageUrl: Schema.STRING.required(),
  }),
  UPDATE: Joi.object({
    full_name: Schema.STRING,
    email: Schema.EMAIL,
  }),
} as const;
