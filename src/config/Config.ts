import { Client as ElasticSearchClient } from "@elastic/elasticsearch";
import Stripe from "stripe";

export class Config
{
    public static readonly PASSWORD_MIN_LENGTH = 10;

    public static readonly SESSION_DURATION = 60 * 60 * 24 * 30;

    public static readonly HASH_ROUNDS = 15;

    public static readonly ID_PREFIXES = {
        USER: "usr",
        ORGANIZATION: "org",
        PUBLISHER: "pub",
        AUTHOR: "aut",
        ARTICLE: "art",
        SESSION: "ses",
        COMMENT: "cmt",
        BUNDLE: "bdl",
    };

    public static readonly ARTICLE_PREVIEW_LENGTH = 200;

    public static readonly STRIPE = new Stripe(process.env.STRIPE_SECRET_API_KEY ?? "", { apiVersion: "2020-08-27" });

    public static readonly STRIPE_CONNECT_FEE_PERCENT = 20;

    public static readonly API_HOST = process.env.ENVIRONMENT === "production"
        ? "https://api.example.com"
        : "http://localhost:4000";

    public static readonly CLIENT_HOST = process.env.ENVIRONMENT === "production"
        ? "https://example.com"
        : "http://localhost:4200";

    public static readonly ELASTICSEARCH = new ElasticSearchClient({
        node: "http://localhost:9200",
    });
}
