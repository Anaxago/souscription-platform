import { useState } from "react";
import { data, useRevalidator } from "react-router";
import type { Route } from "./+types/souscrire.$slug.parcours.$journeyId";
import { api } from "~/lib/api.server";
import UserVerificationStep from "~/components/steps/user-verification-step";
import InvestorProfileStep from "~/components/steps/investor-profile-step";
import ProductQuestionsStep from "~/components/steps/product-questions-step";
import ProductSelectionStep from "~/components/steps/product-selection-step";
import EnvelopeSelectionStep from "~/components/steps/envelope-selection-step";
import DismembermentSelectionStep from "~/components/steps/dismemberment-selection-step";
import AdequacyCheckStep from "~/components/steps/adequacy-check-step";
import DocumentUploadStep from "~/components/steps/document-upload-step";

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
  state: Record<string, unknown> | null;
}

interface SubscriptionJourney {
  id: string;
  investorId: string;
  investorType: string;
  marketingProductId: string;
  status: string;
  currentStepId: string | null;
  steps: JourneyStep[];
  basket: {
    lines: unknown[];
    envelopeTarget: unknown | null;
    productQuestionAnswers: {
      questionId: string;
      questionLabel: string;
      answerId: string;
      snapshotted: boolean;
    }[];
  };
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
    // Try to get error details for debugging
    const err = await journeyRes.json().catch(() => null);
    console.error("Journey fetch failed:", journeyRes.status, err);
    throw data(
      { error: `Parcours introuvable (${journeyRes.status})` },
      { status: journeyRes.status === 400 ? 400 : 404 },
    );
  }

  const journey = (await journeyRes.json()) as SubscriptionJourney;

  // Validate journey has required fields
  if (!journey.steps || !Array.isArray(journey.steps)) {
    throw data({ error: "Parcours invalide" }, { status: 500 });
  }

  // Fetch investor to get personKernelId (needed for KYC)
  let personKernelId: string | null = null;
  const investorRes = await api(`/individual-investors/${journey.investorId}`);
  if (investorRes.ok) {
    const investor = (await investorRes.json()) as { personKernelId: string };
    personKernelId = investor.personKernelId;
  }

  // Fetch marketing product for product selection step
  let marketingProduct: {
    name: string;
    minimumInvestmentInCents: number | null;
    minimumInvestmentCurrency: string;
    financialInstrumentId: string | null;
  } | null = null;
  const productRes = await api(`/marketing-products/${journey.marketingProductId}`);
  if (productRes.ok) {
    const p = (await productRes.json()) as {
      name: string;
      minimumInvestmentInCents: number | null;
      minimumInvestmentCurrency: string;
      financialInstrumentId: string | null;
    };
    marketingProduct = p;
  }

  return { journey, slug, personKernelId, marketingProduct };
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
  const { journey, slug, personKernelId, marketingProduct } = loaderData;
  const revalidator = useRevalidator();
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
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

  const onStepComplete = () => {
    revalidator.revalidate();
  };

  // Auto-render the current step's panel
  const activeStep = currentStep;

  function renderStepPanel(step: JourneyStep) {
    if (step.stepType === "USER_VERIFICATION" && personKernelId) {
      return <UserVerificationStep journeyId={journey.id} stepId={step.id} investorId={journey.investorId} personKernelId={personKernelId} actionUrl={actionUrl} onComplete={onStepComplete} />;
    }
    if (step.stepType === "INVESTOR_PROFILE" && personKernelId) {
      return <InvestorProfileStep journeyId={journey.id} stepId={step.id} investorId={journey.investorId} personKernelId={personKernelId} requiredCategories={(step.config as { requiredCategories?: string[] } | null)?.requiredCategories ?? null} actionUrl={actionUrl} onComplete={onStepComplete} />;
    }
    if (step.stepType === "PRODUCT_SELECTION" && marketingProduct) {
      return <ProductSelectionStep journeyId={journey.id} stepId={step.id} minimumInvestmentInCents={marketingProduct.minimumInvestmentInCents} minimumInvestmentCurrency={marketingProduct.minimumInvestmentCurrency} productName={marketingProduct.name} financialInstrumentId={marketingProduct.financialInstrumentId} existingLines={(journey.basket?.lines ?? []) as unknown as { lineType: string; financialInstrumentId: string | null; requestedAmount: number | null; requestedSecuritiesCount: number | null }[]} actionUrl={actionUrl} onComplete={onStepComplete} />;
    }
    if (step.stepType === "PRODUCT_QUESTIONS") {
      return <ProductQuestionsStep journeyId={journey.id} stepId={step.id} config={step.config as { questions?: { questionId: string; questionLabel: string; choices: { answerId: string; label: string }[] }[] } | null} existingAnswers={journey.basket?.productQuestionAnswers ?? []} actionUrl={actionUrl} onComplete={onStepComplete} />;
    }
    if (step.stepType === "ENVELOPE_SELECTION") {
      return <EnvelopeSelectionStep journeyId={journey.id} stepId={step.id} actionUrl={actionUrl} onComplete={onStepComplete} />;
    }
    if (step.stepType === "DISMEMBERMENT_SELECTION") {
      return <DismembermentSelectionStep journeyId={journey.id} stepId={step.id} actionUrl={actionUrl} onComplete={onStepComplete} />;
    }
    if (step.stepType === "ADEQUACY_CHECK") {
      return <AdequacyCheckStep journeyId={journey.id} stepId={step.id} investorType={journey.investorType} state={step.state as { lastCheckId: string | null; result: "ADEQUATE" | "NEUTRAL" | "INADEQUATE" | "INCOMPLETE_PROFILE" | "OVERRIDDEN" | null; overridden: boolean } | null} actionUrl={actionUrl} onComplete={onStepComplete} />;
    }
    if (step.stepType === "DOCUMENT_UPLOAD") {
      return <DocumentUploadStep journeyId={journey.id} stepId={step.id} config={step.config as { requiredDocumentTypes: string[] | null } | null} state={step.state as { uploadedDocuments: { documentId: string; documentType: string; fileName: string; uploadedAt: string }[] } | null} actionUrl={actionUrl} onComplete={onStepComplete} />;
    }
    // Generic fallback: simple complete button
    return (
      <div className="step-panel">
        <div className="step-panel__header">
          <div className="step-panel__icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--clr-primary)" strokeWidth="1.5"><circle cx="12" cy="12" r="10" /><polyline points="9 12 11 14 15 10" /></svg>
          </div>
          <div>
            <h2 className="step-panel__title">{STEP_TYPE_LABELS[step.stepType] ?? step.stepType}</h2>
            <p className="step-panel__desc">{STEP_TYPE_DESCRIPTIONS[step.stepType] ?? "Complétez cette étape pour continuer."}</p>
          </div>
        </div>
        <button className="btn-primary" style={{ width: "100%", justifyContent: "center" }} disabled={actionLoading === step.id} onClick={() => handleStepAction(step)}>
          {actionLoading === step.id ? "..." : "Valider cette étape"}
        </button>
      </div>
    );
  }

  const currentStepIndex = applicableSteps.findIndex((s) => s.id === currentStep?.id);

  return (
    <div className="ds4-body">
      <nav className="nav-bar scrolled">
        <a className="nav-logo-text" href="/">Anaxago</a>
      </nav>

      <main className="journey-layout">
        {/* ── LEFT: Sidebar stepper ── */}
        <aside className="journey-sidebar">
          <a href={`/souscrire/${slug}`} className="journey-sidebar__back">
            ← Retour au produit
          </a>

          <div className="journey-sidebar__progress">
            <span className="journey-sidebar__progress-text">
              {completedCount}/{applicableSteps.length} complétées
            </span>
            <div className="journey-sidebar__progress-bar">
              <div className="journey-sidebar__progress-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>

          <nav className="journey-stepper">
            {applicableSteps.map((step, i) => {
              const isCurrent = currentStep?.id === step.id;
              const isCompleted = step.stepStatus === "COMPLETED";
              const isPast = i < currentStepIndex;

              return (
                <div key={step.id} className={`journey-stepper__item${isCurrent ? " journey-stepper__item--active" : ""}${isCompleted ? " journey-stepper__item--done" : ""}`}>
                  <div className="journey-stepper__connector">
                    <div className={`journey-stepper__dot${isCompleted ? " journey-stepper__dot--done" : ""}${isCurrent ? " journey-stepper__dot--active" : ""}`}>
                      {isCompleted ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                      ) : (
                        <span>{i + 1}</span>
                      )}
                    </div>
                    {i < applicableSteps.length - 1 && (
                      <div className={`journey-stepper__line${isPast || isCompleted ? " journey-stepper__line--done" : ""}`} />
                    )}
                  </div>
                  <div className="journey-stepper__label">
                    <span className="journey-stepper__name">
                      {STEP_TYPE_LABELS[step.stepType] ?? step.stepType}
                    </span>
                    {isCurrent && <span className="journey-stepper__badge">En cours</span>}
                  </div>
                </div>
              );
            })}
          </nav>
        </aside>

        {/* ── RIGHT: Step content ── */}
        <section className="journey-content">
          {/* Error message */}
          {actionError && (
            <div className="form-error" style={{ marginBottom: "var(--space-md)" }}>{actionError}</div>
          )}

          {/* Active step panel */}
          {activeStep && activeStep.stepStatus !== "COMPLETED" && (
            renderStepPanel(activeStep)
          )}

          {/* Journey completed */}
          {journey.status === "COMPLETED" && (
            <div style={{ padding: "var(--space-2xl) var(--space-xl)", background: "var(--clr-primary-light)", borderRadius: "var(--radius-md)", textAlign: "center" }}>
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="var(--clr-primary)" strokeWidth="1.5" style={{ margin: "0 auto var(--space-md)" }}><circle cx="12" cy="12" r="10" /><polyline points="9 12 11 14 15 10" /></svg>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 300, color: "var(--clr-obsidian)", marginBottom: "var(--space-xs)" }}>Parcours terminé</h2>
              <p style={{ fontSize: 15, color: "var(--clr-cashmere)", maxWidth: 400, margin: "0 auto" }}>Votre souscription est en cours de traitement. Vous recevrez un email de confirmation.</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
