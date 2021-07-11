import accounts from "./accounts";
import articleDrafts from "./article-drafts";
import articleReports from "./article-reports";
import articles from "./articles";
import auth from "./auth";
import authorInvites from "./author-invites";
import authors from "./authors";
import bookmarks from "./bookmarks";
import bundles from "./bundles";
import likes from "./likes";
import organizations from "./organizations";
import paymentMethods from "./payment-methods";
import prices from "./prices";
import publishers from "./publishers";
import sessions from "./sessions";
import subscriptions from "./subscriptions";
import timeseries from "./timeseries";
import users from "./users";
import webhooks from "./webhooks";
import __internals from "./__internals";

export = [
  accounts,
  articleDrafts,
  articleReports,
  articles,
  auth,
  authorInvites,
  authors,
  bookmarks,
  bundles,
  likes,
  organizations,
  paymentMethods,
  prices,
  publishers,
  sessions,
  subscriptions,
  timeseries,
  users,
  webhooks,
  __internals,
].flat();
