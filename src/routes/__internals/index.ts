import { RouteOptions, RouteOptionsAccess } from "@hapi/hapi";
import articleDrafts from "./article-drafts";
import articleReports from "./article-reports";

export = [articleDrafts, articleReports].flat().map((route) => {
  route.path = `/__internals${route.path}`;

  route.options ??= {};
  route.options = route.options as RouteOptions;

  route.options.auth ??= {};
  route.options.auth = route.options.auth as RouteOptionsAccess;

  route.options.auth.scope = "admin";

  return route;
});
