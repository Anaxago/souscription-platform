import { redirect } from "react-router";

export function loader() {
  throw redirect("/catalogue");
}

export default function Home() {
  return null;
}
