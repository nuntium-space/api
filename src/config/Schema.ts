import BaseJoi from "joi";
import JoiDate from "@joi/date";
import { Config, IdPrefixes } from "./Config";

const Joi = BaseJoi.extend(JoiDate) as BaseJoi.Root;

export class Schema {
  public static readonly STRING = Joi.string().trim();

  public static readonly ID = Object.entries(Config.ID_PREFIXES)
    .map(([key, value]) => {
      return { [key]: Schema.STRING.pattern(new RegExp(`^${value}_.+$`)) };
    })
    .reduce((prev, curr) => {
      return { ...prev, ...curr };
    }, {}) as unknown as IdPrefixes<BaseJoi.StringSchema>;

  public static readonly EMAIL = Schema.STRING.email();

  public static readonly URL = Schema.STRING.uri({
    scheme: "https",
    domain: {
      tlds: {
        allow: true,
      },
    },
  });

  public static readonly DATE = Joi.date().utc().format("YYYY-MM-DD");
  public static readonly DATETIME = Joi.date()
    .utc()
    .format("YYYY-MM-DDTHH:mm:ss.SSSZ");

  public static readonly FISCAL_NUMBER = Schema.STRING.uppercase().pattern(
    /^[A-Z]{6}[0-9]{2}[ABCDEHLMPRST][0-9]{2}[A-Z][0-9]{3}[A-Z]$/
  );

  public static readonly MONEY = Joi.number().integer().min(0);
  public static readonly CURRENCY = Schema.STRING.valid(
    ...Config.CURRENCIES.map((_) => _.name)
  ).lowercase();

  public static readonly LATITUDE = Joi.number().min(-90).max(90);
  public static readonly LONGITUDE = Joi.number().min(-180).max(180);
  public static readonly LOCATION = Joi.object({
    latitude: Schema.LATITUDE.required(),
    longitude: Schema.LONGITUDE.required(),
  });

  public static readonly ARRAY = (type: BaseJoi.SchemaLikeWithoutArray) =>
    Joi.array().items(type);

  public static readonly BOOLEAN = Joi.boolean();

  public static readonly NULLABLE = (type: BaseJoi.Schema) => type.allow(null);

  public static readonly LANGUAGE = Schema.STRING.valid(
    ...Config.LANGUAGES.map((_) => _.id)
  );

  public static readonly EXPAND_QUERY = Schema.ARRAY(Schema.STRING);
  public static readonly NOT_EXPANDED_RESOURCE = (
    schema: BaseJoi.StringSchema
  ) => Joi.object({ id: schema.required() });

  public static readonly ARTICLE_CONTENT = Joi.object({
    type: Schema.STRING.valid("doc").required(),
    content: Schema.ARRAY(Joi.object()).required(),
  });
}
