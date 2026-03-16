import type { Route } from "./+types/souscrire.$slug.parcours.$journeyId.action";
import { api } from "~/lib/api.server";

interface ActionBody {
  type: "user-verification" | "complete" | "skip";
  journeyId: string;
  stepId?: string;
}

export async function action({ request }: Route.ActionArgs) {
  const body = (await request.json()) as ActionBody;

  let response: Response;

  if (body.type === "user-verification") {
    response = await api(`/subscription-journeys/${body.journeyId}/user-verification`, {
      method: "POST",
      body: JSON.stringify({ status: "VERIFIED" }),
    });
  } else if (body.type === "skip") {
    response = await api(
      `/subscription-journeys/${body.journeyId}/steps/${body.stepId}/skip`,
      { method: "POST" },
    );
  } else {
    response = await api(
      `/subscription-journeys/${body.journeyId}/steps/${body.stepId}/complete`,
      { method: "POST" },
    );
  }

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    return Response.json(
      { error: (err as Record<string, string>).message ?? `Erreur ${response.status}` },
      { status: response.status },
    );
  }

  const journey = await response.json();
  return Response.json(journey);
}
