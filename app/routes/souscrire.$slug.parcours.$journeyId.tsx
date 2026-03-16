import { useState } from "react";
import { data, useRevalidator } from "react-router";
import type { Route } from "./+types/souscrire.$slug.parcours.$journeyId";
import { api } from "~/lib/api.server";
import UserVerificationStep from "~/components/steps/user-verification-step";

/* ──────────────────────────────────────────────
   Types
   ────────────────────────────────────────────── */

interface JourneyStep {
  id: string;
  stepType: string;
  position: number;
  isRequired: boolean;
  stepStatus: "IN_PROGRESS" | "COMPLETED" | "SKIPPED" | "BLOCKED" | "NOT_STARTED";
  isApplicable: boolean;
  completedAt: string | null;
  config: Record<string, unknown> | null;
}

interface SubscriptionJourney {
  id: string;
  investorId: string;
  investorType: string;
  marketingProductId: string;
  status: string;
  currentStepId: string | null;
  steps: JourneyStep[];
  startedAt: string;
  completedAt: string | null;
}

const STEP_TYPE_LABELS: Record<string, string> = {
  USER_VERIFICATION: "Vérification d'identité",
  INVESTOR_PROFILE: "Profil investisseur",
  PRODUCT_QUESTIONS: "Questions produit",
  PRODUCT_SELECTION: "Sélection du produit",
  ENVELOPE_SELECTION: "Sélection de l'enveloppe",
  DISMEMBERMENT_SELECTION: "Choix du démembrement",
  SHARE_SELECTION: "Sélection des parts",
  ADVISOR_CONSULTATION: "Consultation conseiller",
  DOCUMENT_REVIEW_AND_SIGNATURE: "Revue et signature",
  DOCUMENT_UPLOAD: "Documents justificatifs",
  PRODUCT_SUMMARY: "Récapitulatif produit",
  ADEQUACY_CHECK: "Test d'adéquation",
  INCOME_ASSESSMENT: "Évaluation des revenus",
  RISK_ASSESSMENT: "Profil de risque",
  INVESTMENT_KNOWLEDGE: "Connaissances en investissement",
  BASKET_CONFIGURATION: "Configuration du panier",
  SIGNATURE: "Signature électronique",
  PAYMENT: "Paiement",
  REVIEW: "Récapitulatif",
};

const STEP_TYPE_DESCRIPTIONS: Record<string, string> = {
  USER_VERIFICATION: "Validation de votre identité",
  INVESTOR_PROFILE: "Questionnaire réglementaire KYC",
  PRODUCT_QUESTIONS: "Questions spécifiques au produit",
  PRODUCT_SELECTION: "Choix du support d'investissement",
  ENVELOPE_SELECTION: "Choix du contrat d'assurance-vie",
  DISMEMBERMENT_SELECTION: "Options de démembrement de propriété",
  DOCUMENT_UPLOAD: "Pièce d'identité et justificatifs",
  ADEQUACY_CHECK: "Vérification de l'adéquation du produit",
  DOCUMENT_REVIEW_AND_SIGNATURE: "Signature électronique des documents",
};

const STEP_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  IN_PROGRESS: { label: "En cours", color: "var(--clr-primary)" },
  COMPLETED: { label: "Terminé", color: "var(--clr-primary)" },
  SKIPPED: { label: "Passé", color: "var(--clr-cashmere)" },
  BLOCKED: { label: "Bloqué", color: "var(--clr-mauve)" },
  NOT_STARTED: { label: "À venir", color: "var(--clr-cashmere)" },
};

/**
 * Steps that can be completed via a simple action (button click).
 * Maps stepType → the API call needed.
 */
type StepAction = "user-verification" | "complete" | "skip";

function getStepAction(stepType: string): StepAction | null {
  switch (stepType) {
    case "USER_VERIFICATION":
      return "user-verification";
    case "INVESTOR_PROFILE":
    case "PRODUCT_QUESTIONS":
    case "PRODUCT_SELECTION":
    case "ENVELOPE_SELECTION":
    case "DISMEMBERMENT_SELECTION":
    case "SHARE_SELECTION":
    case "DOCUMENT_UPLOAD":
    case "ADEQUACY_CHECK":
    case "PRODUCT_SUMMARY":
    case "DOCUMENT_REVIEW_AND_SIGNATURE":
      return "complete";
    default:
      return "complete";
  }
}

/* ──────────────────────────────────────────────
   Loader
   ────────────────────────────────────────────── */

export async function loader({ params }: Route.LoaderArgs) {
  const { slug, journeyId } = params;

  const journeyRes = await api(`/subscription-journeys/${journeyId}`);
  if (!journeyRes.ok) {
    throw data(null, { status: 404 });
  }

  const journey = (await journeyRes.json()) as SubscriptionJourney;

  // Fetch investor to get personKernelId (needed for KYC)
  let personKernelId: string | null = null;
  const investorRes = await api(`/individual-investors/${journey.investorId}`);
  if (investorRes.ok) {
    const investor = (await investorRes.json()) as { personKernelId: string };
    personKernelId = investor.personKernelId;
  }

  return { journey, slug, personKernelId };
}

export function meta({ data }: Route.MetaArgs) {
  if (!data) {
    return [{ title: "Parcours introuvable — Anaxago" }];
  }
  return [{ title: "Parcours de souscription — Anaxago" }];
}

/* ──────────────────────────────────────────────
   Component
   ────────────────────────────────────────────── */

export default function ParcoursSouscription({ loaderData }: Route.ComponentProps) {
  const { journey, slug, personKernelId } = loaderData;
  const revalidator = useRevalidator();
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [activeStepId, setActiveStepId] = useState<string | null>(null);
  const actionUrl = `/souscrire/${slug}/parcours/${journey.id}/action`;

  const applicableSteps = journey.steps
    .filter((s) => s.isApplicable)
    .sort((a, b) => a.position - b.position);

  const currentStep =
    applicableSteps.find((s) => s.stepStatus === "IN_PROGRESS") ??
    applicableSteps.find((s) => s.stepStatus !== "COMPLETED" && s.stepStatus !== "SKIPPED");

  const completedCount = applicableSteps.filter((s) => s.stepStatus === "COMPLETED").length;
  const progress =
    applicableSteps.length > 0
      ? Math.round((completedCount / applicableSteps.length) * 100)
      : 0;

  async function handleStepAction(step: JourneyStep) {
    setActionLoading(step.id);
    setActionError(null);

    const action = getStepAction(step.stepType);
    let url: string;
    let body: string | undefined;

    if (action === "user-verification") {
      url = `/souscrire/${slug}/parcours/${journey.id}/action`;
      body = JSON.stringify({ type: "user-verification", journeyId: journey.id });
    } else {
      url = `/souscrire/${slug}/parcours/${journey.id}/action`;
      body = JSON.stringify({ type: "complete", journeyId: journey.id, stepId: step.id });
    }

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setActionError(
          (err as Record<string, string>).error ?? `Erreur ${res.status}`,
        );
      } else {
        revalidator.revalidate();
      }
    } catch {
      setActionError("Erreur de connexion au serveur.");
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="ds4-body">
      <nav className="nav-bar scrolled">
        <a className="nav-logo-text" href="/">Anaxago</a>
      </nav>

      <main style={{ paddingTop: 100 }}>
        <div style={{ maxWidth: 800, margin: "0 auto", padding: "var(--space-xl)" }}>
          <a
            href={`/souscrire/${slug}`}
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 13,
              fontWeight: 600,
              color: "var(--clr-cashmere)",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              marginBottom: "var(--space-lg)",
            }}
          >
            ← Retour au produit
          </a>

          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(28px, 4vw, 36px)",
              fontWeight: 300,
              letterSpacing: "-0.02em",
              color: "var(--clr-obsidian)",
              marginBottom: "var(--space-xs)",
            }}
          >
            Parcours de souscription
          </h1>

          {/* Progress bar */}
          <div style={{ marginBottom: "var(--space-xl)" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "var(--space-xs)",
              }}
            >
              <span style={{ fontSize: 13, color: "var(--clr-cashmere)" }}>
                {completedCount} / {applicableSteps.length} étapes complétées
              </span>
              <span
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--clr-primary)",
                }}
              >
                {progress}%
              </span>
            </div>
            <div
              style={{
                height: 6,
                borderRadius: 3,
                background: "var(--clr-stroke-dark)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${progress}%`,
                  background: "var(--clr-primary)",
                  borderRadius: 3,
                  transition: "width 0.3s ease",
                }}
              />
            </div>
          </div>

          {/* Error message */}
          {actionError && (
            <div className="form-error" style={{ marginBottom: "var(--space-md)" }}>
              {actionError}
            </div>
          )}

          {/* Steps list */}
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {applicableSteps.map((step, i) => {
              const isCurrent = currentStep?.id === step.id;
              const statusInfo =
                STEP_STATUS_LABELS[step.stepStatus] ?? STEP_STATUS_LABELS.NOT_STARTED;
              const isLoading = actionLoading === step.id;
              const canAct = isCurrent && step.stepStatus === "IN_PROGRESS";
              const description = STEP_TYPE_DESCRIPTIONS[step.stepType];

              return (
                <div
                  key={step.id}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "var(--space-sm)",
                    padding: "var(--space-md) 0",
                    borderBottom:
                      i < applicableSteps.length - 1
                        ? "1px solid var(--clr-stroke-dark)"
                        : "none",
                  }}
                >
                  {/* Step number / check */}
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      background:
                        step.stepStatus === "COMPLETED"
                          ? "var(--clr-primary)"
                          : isCurrent
                            ? "var(--clr-primary-light)"
                            : "var(--clr-stroke-dark)",
                      border: isCurrent ? "2px solid var(--clr-primary)" : "none",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {step.stepStatus === "COMPLETED" ? (
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="white"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      <span
                        style={{
                          fontFamily: "var(--font-display)",
                          fontSize: 12,
                          fontWeight: 700,
                          color: isCurrent ? "var(--clr-primary)" : "var(--clr-cashmere)",
                        }}
                      >
                        {i + 1}
                      </span>
                    )}
                  </div>

                  {/* Step info */}
                  <div style={{ flex: 1, paddingTop: 4 }}>
                    <div
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: 15,
                        fontWeight: 600,
                        color:
                          step.stepStatus === "COMPLETED"
                            ? "var(--clr-cashmere)"
                            : "var(--clr-obsidian)",
                      }}
                    >
                      {STEP_TYPE_LABELS[step.stepType] ?? step.stepType}
                    </div>
                    {description && (
                      <div
                        style={{
                          fontSize: 13,
                          color: "var(--clr-cashmere)",
                          marginTop: 2,
                        }}
                      >
                        {description}
                      </div>
                    )}
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: statusInfo.color,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                      }}
                    >
                      {statusInfo.label}
                    </span>
                  </div>

                  {/* Action button for current step */}
                  {canAct && (
                    <button
                      className="btn-primary"
                      style={{
                        padding: "8px 16px",
                        fontSize: 12,
                        flexShrink: 0,
                        marginTop: 2,
                        opacity: isLoading ? 0.6 : 1,
                        cursor: isLoading ? "not-allowed" : "pointer",
                      }}
                      disabled={isLoading}
                      onClick={() => {
                        // Steps with dedicated UI open the step panel
                        if (step.stepType === "USER_VERIFICATION") {
                          setActiveStepId(step.id);
                        } else {
                          handleStepAction(step);
                        }
                      }}
                    >
                      {isLoading ? "..." : step.stepType === "USER_VERIFICATION" ? "Commencer" : "Valider"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── Active step detail panel ── */}
          {activeStepId && (() => {
            const step = applicableSteps.find((s) => s.id === activeStepId);
            if (!step) return null;

            if (step.stepType === "USER_VERIFICATION" && personKernelId) {
              return (
                <div style={{ marginTop: "var(--space-lg)" }}>
                  <UserVerificationStep
                    journeyId={journey.id}
                    stepId={step.id}
                    investorId={journey.investorId}
                    personKernelId={personKernelId}
                    actionUrl={actionUrl}
                    onComplete={() => {
                      setActiveStepId(null);
                      revalidator.revalidate();
                    }}
                  />
                </div>
              );
            }

            return null;
          })()}

          {/* Journey completed */}
          {journey.status === "COMPLETED" && (
            <div
              style={{
                marginTop: "var(--space-lg)",
                padding: "var(--space-md)",
                background: "var(--clr-primary-light)",
                borderRadius: "var(--radius-md)",
                textAlign: "center",
              }}
            >
              <p
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 15,
                  fontWeight: 600,
                  color: "var(--clr-primary)",
                }}
              >
                Parcours de souscription terminé
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
