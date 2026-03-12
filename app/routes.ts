import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("persons/new", "routes/persons.new.tsx"),
] satisfies RouteConfig;
