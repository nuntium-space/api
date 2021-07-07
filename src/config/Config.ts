import { config } from "aws-sdk";
import { Client as ElasticSearchClient } from "@elastic/elasticsearch";
import { CredentialsOptions } from "aws-sdk/lib/credentials";
import Stripe from "stripe";

/* eslint @typescript-eslint/no-var-requires: "off" */
const createAwsElasticsearchConnector = require("aws-elasticsearch-connector");

export interface IdPrefixes<T> {
  ACCOUNT: T;
  ARTICLE: T;
  ARTICLE_DRAFT: T;
  ARTICLE_REPORT: T;
  AUTHOR: T;
  AUTHOR_INVITE: T;
  BUNDLE: T;
  DRAFT_SOURCE: T;
  ORGANIZATION: T;
  PAYMENT_METHOD: T;
  PRICE: T;
  PUBLISHER: T;
  SESSION: T;
  SIGN_IN_REQUEST: T;
  SOURCE: T;
  SUBSCRIPTION: T;
  USER: T;
}

export class Config {
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
  public static readonly SIGN_IN_REQUEST_DURATION_IN_SECONDS = 60 * 5;

  /**
   * @default
   *
   * 7 days
   */
  public static readonly AUTHOR_INVITE_DURATION_IN_SECONDS = 60 * 60 * 24 * 7;

  public static readonly SIGN_IN_REQUEST_TOKEN_BYTES = 60;

  public static readonly ID_PREFIXES: IdPrefixes<string> = {
    ACCOUNT: "acc",
    ARTICLE: "art",
    ARTICLE_DRAFT: "dft",
    ARTICLE_REPORT: "rep",
    AUTHOR: "aut",
    AUTHOR_INVITE: "inv",
    BUNDLE: "bdl",
    DRAFT_SOURCE: "dsr",
    ORGANIZATION: "org",
    PAYMENT_METHOD: "pmt",
    PRICE: "pri",
    PUBLISHER: "pub",
    SESSION: "ses",
    SIGN_IN_REQUEST: "sir",
    SOURCE: "src",
    SUBSCRIPTION: "sub",
    USER: "usr",
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

  public static readonly AUTH_PROVIDERS = [
    {
      id: "facebook",
      display_name: "Facebook",
      getId: (profile: any) => profile.id,
      getEmail: (profile: any) => profile.email,
      getFullName: (profile: any) => profile.displayName,
    },
    {
      id: "google",
      display_name: "Google",
      getId: (profile: any) => profile.id,
      getEmail: (profile: any) => profile.email,
      getFullName: (profile: any) => profile.displayName,
    },
    {
      id: "twitter",
      display_name: "Twitter",
      getId: (profile: any) => profile.id,
      getEmail: (profile: any) => profile.raw.email,
      getFullName: (profile: any) => undefined,
    },
  ];

  public static readonly DOMAIN_VERIFICATION_DNS_TXT_RECORD_PREFIX =
    "nuntium-domain-verification";

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

  public static readonly TRENDING_ARTICLES_MAX_LENGTH = 10;

  public static readonly STRIPE = new Stripe(
    process.env.STRIPE_SECRET_API_KEY ?? "",
    { apiVersion: "2020-08-27" }
  );

  public static readonly STRIPE_CONNECT_FEE_PERCENT = 20;

  public static readonly API_URL = process.env.API_URL as string;
  public static readonly CLIENT_URL = process.env.CLIENT_URL as string;

  public static readonly ELASTICSEARCH = new ElasticSearchClient({
    ...createAwsElasticsearchConnector(config),
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
