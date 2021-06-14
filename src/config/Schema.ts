import BaseJoi from "joi";
import JoiDate from "@joi/date";
import { Config } from "./Config";

const Joi = BaseJoi.extend(JoiDate) as BaseJoi.Root;

export class Schema
{
    public static readonly STRING = Joi.string().trim();

    // TODO: Find a way to make this obj type safe
    public static readonly ID = Object
        .entries(Config.ID_PREFIXES)
        .map(([ key, value ]) =>
        {
            return { [key]: Schema.STRING.pattern(new RegExp(`^${value}_.+$`)) };
        })
        .reduce((prev, curr) =>
        {
            return { ...prev, ...curr };
        }, {});

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
    public static readonly DATETIME = Joi.date().utc().format("YYYY-MM-DDTHH:mm:ss.SSSZ");

    public static readonly FISCAL_NUMBER = Schema.STRING.uppercase().pattern(/^[A-Z]{6}[0-9]{2}[ABCDEHLMPRST][0-9]{2}[A-Z][0-9]{3}[A-Z]$/);

    public static readonly MONEY = Joi.number().integer().min(0);
    public static readonly CURRENCY = Schema.STRING.valid(...Config.CURRENCIES.map(_ => _.name)).lowercase();

    public static readonly LATITUDE = Joi.number().min(-90).max(90);
    public static readonly LONGITUDE = Joi.number().min(-180).max(180);
    public static readonly LOCATION = Joi.object({
        latitude: Schema.LATITUDE.required(),
        longitude: Schema.LONGITUDE.required(),
    });

    public static readonly ARRAY = (type: BaseJoi.SchemaLikeWithoutArray) => Joi.array().items(type);

    public static readonly BOOLEAN = Joi.boolean();

    public static readonly NULLABLE = (type: BaseJoi.Schema) => type.allow(null);

    public static readonly LANGUAGE = Schema.STRING.valid(...Config.LANGUAGES.map(_ => _.id));

    public static readonly EXPAND_QUERY = Schema.ARRAY(Schema.STRING);
    public static readonly NOT_EXPANDED_RESOURCE = (schema: BaseJoi.StringSchema) => Joi.object({ id: schema.required() });

    /////////////////////////////
    // ARTICLE CONTENT SCHEMAS //
    /////////////////////////////

    private static readonly ARTICLE_CONTENT_HARD_BREAK = Joi.object({
        type: Schema.STRING.valid("hardBreak").required(),
    });

    private static readonly ARTICLE_CONTENT_HORIZONTAL_RULE = Joi.object({
        type: Schema.STRING.valid("horizontalRule").required(),
    });

    private static readonly ARTICLE_CONTENT_TEXT = Joi.object({
        type: Schema.STRING.valid("text").required(),
        text: Schema.STRING.required(),
        marks: Schema.ARRAY(
            Joi.object({
                type: Schema.STRING.valid(
                    "bold",
                    "italic",
                    "strike",
                    "underline",
                ).required(),
            })
        ).optional(),
    });

    private static readonly ARTICLE_CONTENT_TEXT_ALIGNMENT = Schema.STRING.valid("left", "center", "right", "justify");

    private static readonly ARTICLE_CONTENT_PARAGRAPH = Joi.object({
        type: Schema.STRING.valid("paragraph").required(),
        attrs: Joi.object({
            textAlign: Schema.ARTICLE_CONTENT_TEXT_ALIGNMENT.required(),
        }),
        content: Schema.ARRAY(
            Joi.alternatives(
                Schema.ARTICLE_CONTENT_HARD_BREAK,
                Schema.ARTICLE_CONTENT_TEXT,
            ),
        ).required(),
    });

    private static readonly ARTICLE_CONTENT_LIST_ITEM = Joi.object({
        type: Schema.STRING.valid("listItem").required(),
        content: Schema.ARRAY(
            Joi.alternatives(
                Joi.link(".."), // Parent ordered / bullet list
                Schema.ARTICLE_CONTENT_PARAGRAPH,
            ),
        ).required(),
    });

    private static readonly ARTICLE_CONTENT_BULLET_LIST = Joi.object({
        type: Schema.STRING.valid("bulletList").required(),
        content: Schema.ARRAY(Schema.ARTICLE_CONTENT_LIST_ITEM).required(),
    });

    private static readonly ARTICLE_CONTENT_ORDERED_LIST = Joi.object({
        type: Schema.STRING.valid("orderedList").required(),
        attrs: Joi.object({
            start: Joi.number().integer(),
        }),
        content: Schema.ARRAY(Schema.ARTICLE_CONTENT_LIST_ITEM).required(),
    });

    private static readonly ARTICLE_CONTENT_HEADING = Joi.object({
        type: Schema.STRING.valid("heading").required(),
        attrs: Joi.object({
            textAlign: Schema.ARTICLE_CONTENT_TEXT_ALIGNMENT.required(),
            level: Joi.number().integer().min(1).max(6).required(),
        }),
        content: Schema.ARRAY(
            Joi.alternatives(
                Schema.ARTICLE_CONTENT_TEXT,
                Schema.ARTICLE_CONTENT_HARD_BREAK,
            ),
        ).optional(),
    });

    private static readonly ARTICLE_CONTENT_CODE_BLOCK = Joi.object({
        type: Schema.STRING.valid("codeBlock").required(),
        attrs: Joi.object({
            language: Schema.NULLABLE(Schema.STRING).required(),
        }),
        content: Schema.ARRAY(Schema.ARTICLE_CONTENT_TEXT).length(1).required(),
    });

    private static readonly ARTICLE_CONTENT_BLOCKQUOTE = Joi.object({
        type: Schema.STRING.valid("blockquote").required(),
        content: Schema.ARRAY(
            Joi.alternatives(
                Schema.ARTICLE_CONTENT_BULLET_LIST,
                Schema.ARTICLE_CONTENT_CODE_BLOCK,
                Schema.ARTICLE_CONTENT_HEADING,
                Schema.ARTICLE_CONTENT_HORIZONTAL_RULE,
                Schema.ARTICLE_CONTENT_ORDERED_LIST,
                Schema.ARTICLE_CONTENT_PARAGRAPH,
            ),
        ).required(),
    });

    public static readonly ARTICLE_CONTENT = Joi.object({
        type: Schema.STRING.valid("doc").required(),
        content: Schema.ARRAY(
            Joi.alternatives(
                Schema.ARTICLE_CONTENT_BLOCKQUOTE,
                Schema.ARTICLE_CONTENT_BULLET_LIST,
                Schema.ARTICLE_CONTENT_CODE_BLOCK,
                Schema.ARTICLE_CONTENT_HEADING,
                Schema.ARTICLE_CONTENT_HORIZONTAL_RULE,
                Schema.ARTICLE_CONTENT_ORDERED_LIST,
                Schema.ARTICLE_CONTENT_PARAGRAPH,
            ),
        ).required(),
    });
}
