import type { Route } from "./+types/souscrire.$slug.parcours.$journeyId.action";
import { api } from "~/lib/api.server";

type ActionPayload =
  | { type: "user-verification"; journeyId: string }
  | { type: "complete"; journeyId: string; stepId: string }
  | { type: "skip"; journeyId: string; stepId: string }
  | { type: "initiate-verification"; personId: string; investorId: string }
  | { type: "request-upload-url"; verificationId: string; fileName: string; contentType: string }
  | { type: "register-document"; verificationId: string; docType: string; storageRef: string; investorId: string }
  | { type: "complete-verification"; journeyId: string; stepId: string };

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function action({ request }: Route.ActionArgs) {
  const body = (await request.json()) as ActionPayload;

  switch (body.type) {
    /* ── User verification flag ── */
    case "user-verification": {
      const res = await api(`/subscription-journeys/${body.journeyId}/user-verification`, {
        method: "POST",
        body: JSON.stringify({ status: "VERIFIED" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return errorResponse((err as Record<string, string>).message ?? `Erreur ${res.status}`, res.status);
      }
      return Response.json(await res.json());
    }

    /* ── Generic step complete ── */
    case "complete": {
      const res = await api(
        `/subscription-journeys/${body.journeyId}/steps/${body.stepId}/complete`,
        { method: "POST" },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return errorResponse((err as Record<string, string>).message ?? `Erreur ${res.status}`, res.status);
      }
      return Response.json(await res.json());
    }

    /* ── Skip step ── */
    case "skip": {
      const res = await api(
        `/subscription-journeys/${body.journeyId}/steps/${body.stepId}/skip`,
        { method: "POST" },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return errorResponse((err as Record<string, string>).message ?? `Erreur ${res.status}`, res.status);
      }
      return Response.json(await res.json());
    }

    /* ── Initiate person verification (KYC) ── */
    case "initiate-verification": {
      // Check if active verification already exists
      const activeRes = await api(`/person-verifications/active/${body.personId}`);
      if (activeRes.ok) {
        const active = await activeRes.json();
        return Response.json(active);
      }

      // Create new verification
      const res = await api("/person-verifications", {
        method: "POST",
        body: JSON.stringify({
          personId: body.personId,
          level: "BASIC",
          initiatedBy: {
            actorId: body.investorId,
            actorType: "CLIENT",
          },
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return errorResponse((err as Record<string, string>).message ?? "Erreur lors de l'initiation KYC", res.status);
      }
      return Response.json(await res.json());
    }

    /* ── Request presigned upload URL ── */
    case "request-upload-url": {
      const res = await api(
        `/person-verifications/${body.verificationId}/documents/upload-url`,
        {
          method: "POST",
          body: JSON.stringify({
            fileName: body.fileName,
            contentType: body.contentType,
          }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return errorResponse((err as Record<string, string>).message ?? "Erreur upload URL", res.status);
      }
      return Response.json(await res.json());
    }

    /* ── Register uploaded document ── */
    case "register-document": {
      const res = await api(
        `/person-verifications/${body.verificationId}/documents`,
        {
          method: "POST",
          body: JSON.stringify({
            type: body.docType,
            storageRef: body.storageRef,
            uploadedBy: {
              actorId: body.investorId,
              actorType: "CLIENT",
            },
          }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return errorResponse((err as Record<string, string>).message ?? "Erreur enregistrement document", res.status);
      }
      return Response.json(await res.json());
    }

    /* ── Complete verification: set VERIFIED + complete step ── */
    case "complete-verification": {
      const verifyRes = await api(
        `/subscription-journeys/${body.journeyId}/user-verification`,
        {
          method: "POST",
          body: JSON.stringify({ status: "VERIFIED" }),
        },
      );
      if (!verifyRes.ok) {
        const err = await verifyRes.json().catch(() => ({}));
        return errorResponse((err as Record<string, string>).message ?? "Erreur vérification", verifyRes.status);
      }

      const completeRes = await api(
        `/subscription-journeys/${body.journeyId}/steps/${body.stepId}/complete`,
        { method: "POST" },
      );
      if (!completeRes.ok) {
        const err = await completeRes.json().catch(() => ({}));
        return errorResponse((err as Record<string, string>).message ?? "Erreur complétion étape", completeRes.status);
      }
      return Response.json(await completeRes.json());
    }

    default:
      return errorResponse("Action inconnue", 400);
  }
}
