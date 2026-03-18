import type { Route } from "./+types/souscrire.$slug.parcours.$journeyId.action";
import { api } from "~/lib/api.server";

type ActionPayload =
  | { type: "user-verification"; journeyId: string }
  | { type: "complete"; journeyId: string; stepId: string }
  | { type: "navigate"; journeyId: string; stepId: string }
  | { type: "skip"; journeyId: string; stepId: string }
  | { type: "initiate-verification"; personId: string; investorId: string }
  | { type: "request-upload-url"; verificationId: string; fileName: string; contentType: string }
  | { type: "register-document"; verificationId: string; docType: string; storageRef: string; investorId: string }
  | { type: "complete-verification"; journeyId: string; stepId: string }
  | { type: "fetch-assessment-questions" }
  | { type: "submit-assessment-category"; investorId: string; personKernelId: string; category: string; answers: { questionId: string; questionVersion: number; questionWordingSnapshot: string; answerValue: string | string[] }[] }
  | { type: "answer-product-questions"; journeyId: string; answers: { questionId: string; questionLabel: string; answerId: string; snapshotted: boolean }[] }
  | { type: "add-basket-line"; journeyId: string; lineType: string; financialInstrumentId: string | null; shareId: string | null; requestedAmount: number }
  | { type: "set-envelope-target"; journeyId: string; targetType: string; envelopeType: string; existingEnvelopeRef?: string }
  | { type: "update-basket-dismemberment"; journeyId: string; dismembermentType: string }
  | { type: "evaluate-adequacy"; journeyId: string; stepId: string; investorType: string }
  | { type: "override-adequacy"; checkId: string; journeyId: string; stepId: string }
  | { type: "upload-journey-document"; journeyId: string; stepId: string; documentType: string; documentId: string; fileName: string }
  | { type: "update-person-kernel"; personKernelId: string; firstName: string; lastName: string }
  | { type: "create-person"; personKernelId: string; firstName: string; lastName: string; birthDate: string; nationality: string; address: { street: string; city: string; postalCode: string; country: string } }
  | { type: "create-account"; personId: string; email: string; phone: string };

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

    /* ── Navigate to step ── */
    case "navigate": {
      const res = await api(
        `/subscription-journeys/${body.journeyId}/steps/${body.stepId}/navigate`,
        { method: "POST" },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return errorResponse((err as Record<string, string>).message ?? `Erreur navigation`, res.status);
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

    /* ── Complete verification: set VERIFIED (step auto-completes) ── */
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
      // Step auto-completes via event — no need to call completeStep
      return Response.json(await verifyRes.json());
    }

    /* ── Add basket line ── */
    case "add-basket-line": {
      const lineBody: Record<string, unknown> = {
        lineType: body.lineType,
        requestedAmount: body.requestedAmount,
      };
      if (body.financialInstrumentId) {
        lineBody.financialInstrumentId = body.financialInstrumentId;
      }
      if (body.shareId) {
        lineBody.shareId = body.shareId;
      }
      const res = await api(
        `/subscription-journeys/${body.journeyId}/basket/lines`,
        { method: "POST", body: JSON.stringify(lineBody) },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return errorResponse((err as Record<string, string>).message ?? "Erreur ajout panier", res.status);
      }
      return Response.json(await res.json());
    }

    /* ── Set envelope target ── */
    case "set-envelope-target": {
      const envelopeBody: Record<string, unknown> = {
        targetType: body.targetType,
        envelopeType: body.envelopeType,
      };
      if (body.existingEnvelopeRef) {
        envelopeBody.existingEnvelopeRef = body.existingEnvelopeRef;
      }
      const res = await api(
        `/subscription-journeys/${body.journeyId}/basket/envelope-target`,
        { method: "PUT", body: JSON.stringify(envelopeBody) },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return errorResponse((err as Record<string, string>).message ?? "Erreur enveloppe", res.status);
      }
      return Response.json(await res.json());
    }

    /* ── Update basket line dismemberment ── */
    case "update-basket-dismemberment": {
      // Update the first basket line with dismemberment type
      const res = await api(
        `/subscription-journeys/${body.journeyId}/basket/lines/0`,
        { method: "PATCH", body: JSON.stringify({ dismembermentType: body.dismembermentType }) },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return errorResponse((err as Record<string, string>).message ?? "Erreur démembrement", res.status);
      }
      return Response.json(await res.json());
    }

    /* ── Evaluate adequacy ── */
    case "evaluate-adequacy": {
      const res = await api(
        `/subscription-journeys/${body.journeyId}/steps/${body.stepId}/evaluate-adequacy`,
        { method: "POST", body: JSON.stringify({ investorType: body.investorType }) },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return errorResponse((err as Record<string, string>).message ?? "Erreur adéquation", res.status);
      }
      return Response.json(await res.json());
    }

    /* ── Override adequacy ── */
    case "override-adequacy": {
      const overrideRes = await api(`/adequacy-checks/${body.checkId}/override`, {
        method: "POST",
        body: JSON.stringify({
          overrideReason: "L'investisseur confirme avoir compris les risques",
          consentRecordedAt: new Date().toISOString(),
        }),
      });
      if (!overrideRes.ok) {
        const err = await overrideRes.json().catch(() => ({}));
        return errorResponse((err as Record<string, string>).message ?? "Erreur override", overrideRes.status);
      }
      // ADEQUACY_CHECK is event-driven — step auto-completes after override
      return Response.json(await overrideRes.json());
    }

    /* ── Upload journey document ── */
    case "upload-journey-document": {
      const res = await api(
        `/subscription-journeys/${body.journeyId}/steps/${body.stepId}/documents`,
        {
          method: "POST",
          body: JSON.stringify({
            documentType: body.documentType,
            documentId: body.documentId,
            fileName: body.fileName,
          }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return errorResponse((err as Record<string, string>).message ?? "Erreur upload document", res.status);
      }
      return Response.json(await res.json());
    }

    /* ── Answer product questions ── */
    case "answer-product-questions": {
      const res = await api(
        `/subscription-journeys/${body.journeyId}/basket/product-questions`,
        {
          method: "POST",
          body: JSON.stringify({ answers: body.answers }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return errorResponse((err as Record<string, string>).message ?? "Erreur questions produit", res.status);
      }
      return Response.json(await res.json());
    }

    /* ── Fetch assessment questions ── */
    case "fetch-assessment-questions": {
      const res = await api("/assessment-questions?pageSize=100");
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return errorResponse((err as Record<string, string>).message ?? "Erreur chargement questions", res.status);
      }
      return Response.json(await res.json());
    }

    /* ── Submit assessment category (start session → answer → validate) ── */
    case "submit-assessment-category": {
      // 1. Get or create assessment
      let assessmentId: string;
      const existingRes = await api(`/investor-assessments/by-investor/${body.investorId}`);
      if (existingRes.ok) {
        const existing = (await existingRes.json()) as { id: string };
        assessmentId = existing.id;
      } else {
        // No assessment yet — start-session will create one
        assessmentId = "";
      }

      // 2. Start session for this category
      const sessionRes = await api("/investor-assessments/start-session", {
        method: "POST",
        body: JSON.stringify({
          investorId: body.investorId,
          investorType: "INDIVIDUAL",
          category: body.category,
          initiatedBy: body.personKernelId,
          initiatedByRole: "CLIENT",
        }),
      });
      if (!sessionRes.ok) {
        const err = await sessionRes.json().catch(() => ({}));
        return errorResponse((err as Record<string, string>).message ?? "Erreur démarrage session", sessionRes.status);
      }
      const sessionData = (await sessionRes.json()) as { id: string; categoryStates: { category: string; sessions: { id: string; status: string }[] }[] };
      assessmentId = sessionData.id;

      // Find the session ID for this category (last DRAFT session)
      const catState = sessionData.categoryStates?.find((cs: { category: string }) => cs.category === body.category);
      const draftSession = catState?.sessions?.find((s: { status: string }) => s.status === "DRAFT");
      const sessionId = draftSession?.id;

      if (!sessionId) {
        return errorResponse("Session non trouvée après création", 500);
      }

      // 3. Submit each answer
      for (const answer of body.answers) {
        const answerRes = await api(`/investor-assessments/${assessmentId}/answers`, {
          method: "POST",
          body: JSON.stringify({
            category: body.category,
            sessionId,
            questionId: answer.questionId,
            questionVersion: answer.questionVersion,
            questionWordingSnapshot: answer.questionWordingSnapshot,
            answerValue: answer.answerValue,
            answeredBy: body.personKernelId,
            answeredByRole: "CLIENT",
          }),
        });
        if (!answerRes.ok) {
          const err = await answerRes.json().catch(() => ({}));
          return errorResponse((err as Record<string, string>).message ?? "Erreur soumission réponse", answerRes.status);
        }
      }

      // 4. Validate session
      const validateRes = await api(`/investor-assessments/${assessmentId}/validate-session`, {
        method: "POST",
        body: JSON.stringify({
          category: body.category,
          sessionId,
          rawScore: body.answers.length,
          normalizedScore: 5000,
          scoringConfigVersion: 1,
          label: body.category,
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        }),
      });
      if (!validateRes.ok) {
        const err = await validateRes.json().catch(() => ({}));
        return errorResponse((err as Record<string, string>).message ?? "Erreur validation session", validateRes.status);
      }

      return Response.json(await validateRes.json());
    }

    /* ── Create full Person (identity + address) ── */
    case "create-person": {
      const res = await api("/persons", {
        method: "POST",
        body: JSON.stringify({
          firstName: body.firstName,
          lastName: body.lastName,
          birthDate: body.birthDate,
          nationality: body.nationality,
          address: body.address,
          personKernelId: body.personKernelId,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        // Ignore conflict (person already exists for this kernel)
        if (res.status === 409) {
          return Response.json({ ok: true });
        }
        return errorResponse((err as Record<string, string>).message ?? "Erreur création personne", res.status);
      }
      return Response.json(await res.json());
    }

    /* ── Update person kernel name ── */
    case "update-person-kernel": {
      const res = await api(`/person-kernels/${body.personKernelId}`, {
        method: "PATCH",
        body: JSON.stringify({
          firstName: body.firstName,
          lastName: body.lastName,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return errorResponse((err as Record<string, string>).message ?? "Erreur mise à jour identité", res.status);
      }
      return Response.json(await res.json());
    }

    /* ── Create Account (email + phone) ── */
    case "create-account": {
      const res = await api("/accounts", {
        method: "POST",
        body: JSON.stringify({
          email: body.email,
          phone: body.phone,
          personId: body.personId,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 409) {
          return Response.json({ ok: true });
        }
        return errorResponse((err as Record<string, string>).message ?? "Erreur création compte", res.status);
      }
      return Response.json(await res.json());
    }

    default:
      return errorResponse("Action inconnue", 400);
  }
}
