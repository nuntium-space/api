import AWS from "aws-sdk";
import { Client as ElasticSearchClient } from "@elastic/elasticsearch";
import { CredentialsOptions } from "aws-sdk/lib/credentials";
import Stripe from "stripe";

const createAwsElasticsearchConnector = require('aws-elasticsearch-connector')

export class Config
{
    public static readonly IS_PRODUCTION = process.env.NODE_ENV === "production";

    /**
     * @default
     * 
     * 30 days
     */
    public static readonly SESSION_DURATION_IN_SECONDS = 60 * 60 * 24 * 30;

    /**
     * @default
     * 
     * 5 minutes
     */
    public static readonly SIGN_IN_REQUEST_DURATION = 60 * 5;

    public static readonly SIGN_IN_REQUEST_TOKEN_BYTES = 60;

    public static readonly ID_PREFIXES = {
        USER: "usr",
        ORGANIZATION: "org",
        PUBLISHER: "pub",
        AUTHOR: "aut",
        ARTICLE: "art",
        SESSION: "ses",
        COMMENT: "cmt",
        BUNDLE: "bdl",
        SUBSCRIPTION: "sub",
        PAYMENT_METHOD: "pmt",
        PRICE: "pri",
        ACCOUNT: "acc",
        SIGN_IN_REQUEST: "sir",
        SOURCE: "src",
    };

    public static readonly LANGUAGES = [
        {
            id: "en",
            display_name: "English",
        },
        {
            id: "it",
            display_name: "Italiano",
        },
    ];

    public static readonly CURRENCIES = [
        {
            name: "usd",
            min: 100,
        },
        {
            name: "eur",
            min: 100,
        },
    ];

    public static readonly DOMAIN_VERIFICATION_DNS_TXT_RECORD_PREFIX = "nuntium-domain-verification";

    /**
     * @default
     * 
     * 1MiB
     */
    public static readonly PUBLISHER_IMAGE_MAX_SIZE = 2 ** 20;

    public static readonly PUBLISHER_IMAGE_SUPPORTED_MIME_TYPES = [
        "image/jpeg",
        "image/png",
    ];

    public static readonly PUBLISHER_DNS_TXT_VALUE_BYTES = 30;

    public static readonly RECENT_ARTICLES_MAX_LENGTH = 3;
    public static readonly TRENDING_ARTICLES_MAX_LENGTH = 3;

    public static readonly STRIPE = new Stripe(process.env.STRIPE_SECRET_API_KEY ?? "", { apiVersion: "2020-08-27" });

    public static readonly STRIPE_CONNECT_FEE_PERCENT = 20;

    public static readonly API_URL = process.env.API_URL as string;
    public static readonly CLIENT_URL = process.env.CLIENT_URL as string;

    public static readonly ELASTICSEARCH = new ElasticSearchClient({
        ...createAwsElasticsearchConnector(AWS.config),
        node: process.env.ELASTICSEARCH_URL,
    });

    public static readonly AWS_CREDENTIALS: CredentialsOptions = {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
    };

    public static readonly AWS_ENDPOINT = Config.IS_PRODUCTION
        ? undefined
        : "http://localhost:4566";
}
