import { data } from "react-router";
import type { Route } from "./+types/souscrire.$slug.parcours.$journeyId";
import { api } from "~/lib/api.server";

/* ──────────────────────────────────────────────
   Types
   ────────────────────────────────────────────── */

interface JourneyStep {
  id: string;
  stepType: string;
  position: number;
  isRequired: boolean;
  stepStatus: "IN_PROGRESS" | "COMPLETED" | "SKIPPED" | "BLOCKED";
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
  INCOME_ASSESSMENT: "Évaluation des revenus",
  RISK_ASSESSMENT: "Profil de risque",
  INVESTMENT_KNOWLEDGE: "Connaissances en investissement",
  ADEQUACY_CHECK: "Test d'adéquation",
  DOCUMENT_UPLOAD: "Documents justificatifs",
  PRODUCT_SELECTION: "Sélection du produit",
  BASKET_CONFIGURATION: "Configuration du panier",
  SIGNATURE: "Signature électronique",
  PAYMENT: "Paiement",
  REVIEW: "Récapitulatif",
};

const STEP_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  IN_PROGRESS: { label: "En cours", color: "var(--clr-primary)" },
  COMPLETED: { label: "Terminé", color: "var(--clr-primary)" },
  SKIPPED: { label: "Passé", color: "var(--clr-cashmere)" },
  BLOCKED: { label: "Bloqué", color: "var(--clr-mauve)" },
};

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
  return { journey, slug };
}

export function meta({ data }: Route.MetaArgs) {
  if (!data) {
    return [{ title: "Parcours introuvable — Anaxago" }];
  }
  return [
    { title: "Parcours de souscription — Anaxago" },
  ];
}

/* ──────────────────────────────────────────────
   Component
   ────────────────────────────────────────────── */

export default function ParcoursSouscription({ loaderData }: Route.ComponentProps) {
  const { journey, slug } = loaderData;
  const applicableSteps = journey.steps
    .filter((s) => s.isApplicable)
    .sort((a, b) => a.position - b.position);

  const currentStep = applicableSteps.find((s) => s.stepStatus === "IN_PROGRESS")
    ?? applicableSteps.find((s) => s.stepStatus !== "COMPLETED" && s.stepStatus !== "SKIPPED");

  const completedCount = applicableSteps.filter((s) => s.stepStatus === "COMPLETED").length;
  const progress = applicableSteps.length > 0
    ? Math.round((completedCount / applicableSteps.length) * 100)
    : 0;

  return (
    <div className="ds4-body">
      {/* Navbar */}
      <nav className="nav-bar scrolled">
        <a className="nav-logo-text" href="/">Anaxago</a>
      </nav>

      <main style={{ paddingTop: 100 }}>
        <div style={{ maxWidth: 800, margin: "0 auto", padding: "var(--space-xl)" }}>
          {/* Back link */}
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

          {/* Header */}
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
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "var(--space-xs)",
            }}>
              <span style={{ fontSize: 13, color: "var(--clr-cashmere)" }}>
                {completedCount} / {applicableSteps.length} étapes complétées
              </span>
              <span style={{
                fontFamily: "var(--font-display)",
                fontSize: 13,
                fontWeight: 600,
                color: "var(--clr-primary)",
              }}>
                {progress}%
              </span>
            </div>
            <div style={{
              height: 6,
              borderRadius: 3,
              background: "var(--clr-stroke-dark)",
              overflow: "hidden",
            }}>
              <div style={{
                height: "100%",
                width: `${progress}%`,
                background: "var(--clr-primary)",
                borderRadius: 3,
                transition: "width 0.3s ease",
              }} />
            </div>
          </div>

          {/* Steps list */}
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {applicableSteps.map((step, i) => {
              const isCurrent = currentStep?.id === step.id;
              const statusInfo = STEP_STATUS_LABELS[step.stepStatus] ?? STEP_STATUS_LABELS.BLOCKED;

              return (
                <div
                  key={step.id}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "var(--space-sm)",
                    padding: "var(--space-md) 0",
                    borderBottom: i < applicableSteps.length - 1
                      ? "1px solid var(--clr-stroke-dark)"
                      : "none",
                  }}
                >
                  {/* Step number / check */}
                  <div style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: step.stepStatus === "COMPLETED"
                      ? "var(--clr-primary)"
                      : isCurrent
                        ? "var(--clr-primary-light)"
                        : "var(--clr-stroke-dark)",
                    border: isCurrent ? "2px solid var(--clr-primary)" : "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    {step.stepStatus === "COMPLETED" ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      <span style={{
                        fontFamily: "var(--font-display)",
                        fontSize: 12,
                        fontWeight: 700,
                        color: isCurrent ? "var(--clr-primary)" : "var(--clr-cashmere)",
                      }}>
                        {i + 1}
                      </span>
                    )}
                  </div>

                  {/* Step info */}
                  <div style={{ flex: 1, paddingTop: 4 }}>
                    <div style={{
                      fontFamily: "var(--font-display)",
                      fontSize: 15,
                      fontWeight: 600,
                      color: step.stepStatus === "COMPLETED"
                        ? "var(--clr-cashmere)"
                        : "var(--clr-obsidian)",
                    }}>
                      {STEP_TYPE_LABELS[step.stepType] ?? step.stepType}
                    </div>
                    <span style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: statusInfo.color,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                    }}>
                      {statusInfo.label}
                    </span>
                  </div>

                  {/* Arrow for current step */}
                  {isCurrent && (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--clr-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 6 }}>
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  )}
                </div>
              );
            })}
          </div>

          {/* Journey status */}
          {journey.status === "COMPLETED" && (
            <div style={{
              marginTop: "var(--space-lg)",
              padding: "var(--space-md)",
              background: "var(--clr-primary-light)",
              borderRadius: "var(--radius-md)",
              textAlign: "center",
            }}>
              <p style={{
                fontFamily: "var(--font-display)",
                fontSize: 15,
                fontWeight: 600,
                color: "var(--clr-primary)",
              }}>
                Parcours de souscription terminé
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
