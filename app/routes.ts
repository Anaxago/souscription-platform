import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("persons/new", "routes/persons.new.tsx"),
  route("products/new", "routes/products.new.tsx"),
  route("souscrire/:slug", "routes/souscrire.$slug.tsx"),
  route(
    "souscrire/documents/:productId/:documentId",
    "routes/souscrire.documents.$productId.$documentId.tsx",
  ),
] satisfies RouteConfig;
