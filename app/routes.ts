import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("catalogue", "routes/catalogue.tsx"),
  route("persons/new", "routes/persons.new.tsx"),
  route("products/new", "routes/products.new.tsx"),
  route("souscrire/:slug", "routes/souscrire.$slug.tsx"),
  route("souscrire/:slug/demarrer", "routes/souscrire.$slug.demarrer.tsx"),
  route("souscrire/:slug/parcours/:journeyId", "routes/souscrire.$slug.parcours.$journeyId.tsx"),
  route("souscrire/:slug/parcours/:journeyId/action", "routes/souscrire.$slug.parcours.$journeyId.action.tsx"),
  route(
    "souscrire/documents/:productId/:documentId",
    "routes/souscrire.documents.$productId.$documentId.tsx",
  ),
] satisfies RouteConfig;
