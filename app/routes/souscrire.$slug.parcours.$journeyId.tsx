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
import ProductSummaryStep from "~/components/steps/product-summary-step";
import KnowledgeQuizStep from "~/components/steps/knowledge-quiz-step";


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
  PRODUCT_SELECTION: "Montant à investir",
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
  KNOWLEDGE_QUIZ: "Quiz de connaissances",
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
  KNOWLEDGE_QUIZ: "Évaluez vos connaissances financières",
  DOCUMENT_REVIEW_AND_SIGNATURE: "Signature électronique des documents",
};

const RISK_TOLERANCE_LABELS: Record<string, string> = {
  CONSERVATIVE: "Prudent",
  MODERATE: "Modéré",
  BALANCED: "Équilibré",
  DYNAMIC: "Dynamique",
  AGGRESSIVE: "Offensif",
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
  if (!journey.steps || !Array.isArray(journey.steps)) {
    throw data(null, { status: 404 });
  }

  // Fetch investor + marketing product in PARALLEL (both only depend on journey)
  const investorEndpoint = journey.investorType === "LEGAL"
    ? `/legal-entity-investors/${journey.investorId}`
    : `/individual-investors/${journey.investorId}`;

  const [investorRes, productRes] = await Promise.all([
    api(investorEndpoint),
    api(`/marketing-products/${journey.marketingProductId}`),
  ]);

  // Parse investor
  let personKernelId: string | null = null;
  let legalEntityKernelId: string | null = null;
  let riskTolerance: string | null = null;
  if (investorRes.ok) {
    if (journey.investorType === "LEGAL") {
      const investor = (await investorRes.json()) as { legalEntityKernelId: string; operatedBy: string; riskTolerance?: string | null };
      legalEntityKernelId = investor.legalEntityKernelId;
      personKernelId = investor.operatedBy;
      riskTolerance = investor.riskTolerance ?? null;
    } else {
      const investor = (await investorRes.json()) as { personKernelId: string; riskTolerance?: string | null };
      personKernelId = investor.personKernelId;
      riskTolerance = investor.riskTolerance ?? null;
    }
  }

  // Parse marketing product + fetch shares in parallel if needed
  let marketingProduct: {
    name: string;
    minimumInvestmentInCents: number | null;
    minimumInvestmentCurrency: string;
    financialInstrumentId: string | null;
    shares: { id: string; name: string; minimumInvestmentInCents: number; minimumInvestmentCurrency: string }[];
  } | null = null;
  let eligibleEnvelopes: { category: string; name: string }[] = [];
  if (productRes.ok) {
    const p = (await productRes.json()) as {
      name: string;
      minimumInvestmentInCents: number | null;
      minimumInvestmentCurrency: string;
      financialInstrumentId: string | null;
      eligibleEnvelopeCategories?: string[];
    };

    if (p.eligibleEnvelopeCategories && p.eligibleEnvelopeCategories.length > 0) {
      eligibleEnvelopes = p.eligibleEnvelopeCategories.map((cat) => ({ category: cat, name: cat }));
    }

    let shares: { id: string; name: string; minimumInvestmentInCents: number; minimumInvestmentCurrency: string }[] = [];
    if (p.financialInstrumentId) {
      const fiRes = await api(`/financial-instruments/${p.financialInstrumentId}`);
      if (fiRes.ok) {
        const fi = (await fiRes.json()) as {
          shares: { id: string; name: string; minimumInvestmentInCents: number; minimumInvestmentCurrency: string }[];
        };
        shares = fi.shares ?? [];
      }
    }
    marketingProduct = { ...p, shares };
  }

  return { journey, slug, personKernelId, legalEntityKernelId, marketingProduct, eligibleEnvelopes, riskTolerance };
}

export function headers() {
  return { "Cache-Control": "private, no-store" };
}

export function meta({ data }: Route.MetaArgs) {
  if (!data) {
    return [{ title: "Parcours introuvable — Stanza" }];
  }
  return [{ title: "Parcours de souscription — Stanza" }];
}

/* ──────────────────────────────────────────────
   Component
   ────────────────────────────────────────────── */

export default function ParcoursSouscription({ loaderData }: Route.ComponentProps) {
  const { journey, slug, personKernelId, legalEntityKernelId, marketingProduct, eligibleEnvelopes, riskTolerance } = loaderData;
  const revalidator = useRevalidator();
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [overrideStepId, setOverrideStepId] = useState<string | null>(null);
  const [stepKey, setStepKey] = useState(0);
  const actionUrl = `/souscrire/${slug}/parcours/${journey.id}/action`;

  const applicableSteps = journey.steps
    .filter((s) => s.isApplicable)
    .sort((a, b) => a.position - b.position);

  // Steps that are IN_PROGRESS but effectively done — skip past them
  const isStepPendingApproval = (s: JourneyStep) => {
    if (s.stepStatus !== "IN_PROGRESS") return false;
    // USER_VERIFICATION with kycStatus VERIFIED
    if (s.stepType === "USER_VERIFICATION") {
      return (s.state as { kycStatus?: string } | null)?.kycStatus === "VERIFIED";
    }
    // INVESTOR_PROFILE with any submitted categories — don't block navigation
    if (s.stepType === "INVESTOR_PROFILE") {
      const catResults = (s.state as { categoryResults?: { validated: boolean }[] } | null)?.categoryResults;
      return catResults != null && catResults.some((c) => c.validated);
    }
    return false;
  };

  const currentStep =
    applicableSteps.find((s) => s.stepStatus === "IN_PROGRESS" && !isStepPendingApproval(s)) ??
    applicableSteps.find((s) => s.stepStatus !== "COMPLETED" && s.stepStatus !== "SKIPPED" && !isStepPendingApproval(s)) ??
    applicableSteps.find((s) => s.stepStatus === "IN_PROGRESS");

  console.log("[Parcours] steps", applicableSteps.map((s) => `${s.stepType}:${s.stepStatus}`));
  console.log("[Parcours] currentStep", currentStep?.stepType, currentStep?.stepStatus);

  const completedCount = applicableSteps.filter((s) => s.stepStatus === "COMPLETED" || isStepPendingApproval(s)).length;
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

  async function navigateToStep(stepId: string) {
    setActionError(null);
    setOverrideStepId(stepId);
    try {
      await fetch(actionUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "navigate", journeyId: journey.id, stepId }),
      });
      revalidator.revalidate();
    } catch {
      // Navigation is best-effort — even if API fails, show the step
    }
  }

  const onStepComplete = () => {
    console.log("[Parcours] onStepComplete — clearing override, revalidating");
    setOverrideStepId(null);
    setStepKey((k) => k + 1);
    revalidator.revalidate();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Show overridden step or current step
  const activeStep = overrideStepId
    ? applicableSteps.find((s) => s.id === overrideStepId) ?? currentStep
    : currentStep;

  function renderStepPanel(step: JourneyStep) {
    if (step.stepType === "USER_VERIFICATION" && personKernelId) {
      return <UserVerificationStep journeyId={journey.id} stepId={step.id} investorId={journey.investorId} personKernelId={personKernelId} investorType={journey.investorType} legalEntityKernelId={legalEntityKernelId} requiredQuestions={(step.config as { requiredQuestions?: string[] } | null)?.requiredQuestions ?? []} questionResults={(step.state as { questionResults?: { questionType: string; answered: boolean; answer: string | null }[] } | null)?.questionResults ?? []} actionUrl={actionUrl} onComplete={onStepComplete} />;
    }
    if (step.stepType === "INVESTOR_PROFILE" && personKernelId) {
      return <InvestorProfileStep journeyId={journey.id} stepId={step.id} investorId={journey.investorId} personKernelId={personKernelId} investorType={journey.investorType} requiredCategories={(step.config as { requiredCategories?: string[] } | null)?.requiredCategories ?? null} actionUrl={actionUrl} onComplete={onStepComplete} />;
    }
    if (step.stepType === "KNOWLEDGE_QUIZ") {
      const quizFiId = (step.config as { financialInstrumentId?: string } | null)?.financialInstrumentId ?? marketingProduct?.financialInstrumentId ?? null;
      return <KnowledgeQuizStep journeyId={journey.id} stepId={step.id} investorId={journey.investorId} investorType={journey.investorType} personKernelId={personKernelId ?? ""} financialInstrumentId={quizFiId} actionUrl={actionUrl} onComplete={onStepComplete} />;
    }
    if (step.stepType === "PRODUCT_SELECTION" && marketingProduct) {
      return <ProductSelectionStep journeyId={journey.id} stepId={step.id} minimumInvestmentInCents={marketingProduct.minimumInvestmentInCents} minimumInvestmentCurrency={marketingProduct.minimumInvestmentCurrency} productName={marketingProduct.name} financialInstrumentId={marketingProduct.financialInstrumentId} shares={marketingProduct.shares} existingLines={(journey.basket?.lines ?? []) as unknown as { lineType: string; financialInstrumentId: string | null; requestedAmount: number | null; requestedSecuritiesCount: number | null }[]} actionUrl={actionUrl} onComplete={onStepComplete} />;
    }
    if (step.stepType === "PRODUCT_QUESTIONS") {
      return <ProductQuestionsStep journeyId={journey.id} stepId={step.id} config={step.config as { questions?: { questionId: string; questionLabel: string; choices: { answerId: string; label: string }[] }[] } | null} existingAnswers={journey.basket?.productQuestionAnswers ?? []} actionUrl={actionUrl} onComplete={onStepComplete} />;
    }
    if (step.stepType === "ENVELOPE_SELECTION") {
      return <EnvelopeSelectionStep journeyId={journey.id} stepId={step.id} eligibleEnvelopes={eligibleEnvelopes} actionUrl={actionUrl} onComplete={onStepComplete} />;
    }
    if (step.stepType === "DISMEMBERMENT_SELECTION") {
      return <DismembermentSelectionStep journeyId={journey.id} stepId={step.id} actionUrl={actionUrl} onComplete={onStepComplete} />;
    }
    if (step.stepType === "ADEQUACY_CHECK") {
      const basketData = journey.basket as unknown as { lines: { requestedAmount: number | null }[]; envelopeTarget: { envelopeType: string } | null } | null;
      return <AdequacyCheckStep journeyId={journey.id} stepId={step.id} investorType={journey.investorType} productName={marketingProduct?.name ?? null} envelopeType={basketData?.envelopeTarget?.envelopeType ?? null} amount={basketData?.lines?.[0]?.requestedAmount ?? null} state={step.state as { lastCheckId: string | null; result: "ADEQUATE" | "NEUTRAL" | "INADEQUATE" | "INCOMPLETE_PROFILE" | "OVERRIDDEN" | null; overridden: boolean } | null} actionUrl={actionUrl} onComplete={onStepComplete} />;
    }
    if (step.stepType === "DOCUMENT_UPLOAD") {
      return <DocumentUploadStep journeyId={journey.id} stepId={step.id} config={step.config as { requiredDocumentTypes: string[] | null } | null} state={step.state as { uploadedDocuments: { documentId: string; documentType: string; fileName: string; uploadedAt: string }[] } | null} actionUrl={actionUrl} onComplete={onStepComplete} />;
    }
    if (step.stepType === "PRODUCT_SUMMARY") {
      return <ProductSummaryStep journeyId={journey.id} stepId={step.id} investorId={journey.investorId} investorType={journey.investorType} productName={marketingProduct?.name ?? null} basket={journey.basket as unknown as { lines: { lineType: string; requestedAmount: number | null }[]; envelopeTarget: { envelopeType: string; provider: string | null } | null } | null} actionUrl={actionUrl} onComplete={onStepComplete} />;
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
        <a className="nav-logo-text" href="/">Stanza</a>
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

          {riskTolerance && (
            <div style={{
              display: "flex", alignItems: "center", gap: "var(--space-xs)",
              padding: "var(--space-sm) var(--space-md)",
              background: "var(--clr-primary-light)",
              borderRadius: "var(--radius-md)",
              marginBottom: "var(--space-md)",
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--clr-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
              </svg>
              <span style={{ fontSize: 13, color: "var(--clr-cashmere)" }}>Profil :</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--clr-primary)" }}>
                {RISK_TOLERANCE_LABELS[riskTolerance] ?? riskTolerance}
              </span>
            </div>
          )}

          <nav className="journey-stepper">
            {applicableSteps.map((step, i) => {
              const isCurrent = (overrideStepId ? overrideStepId === step.id : currentStep?.id === step.id);
              const isCompleted = step.stepStatus === "COMPLETED";
              const isPast = i < currentStepIndex;
              const isClickable = isCompleted || isPast;

              return (
                <div
                  key={step.id}
                  className={`journey-stepper__item${isCurrent ? " journey-stepper__item--active" : ""}${isCompleted ? " journey-stepper__item--done" : ""}${isClickable ? " journey-stepper__item--clickable" : ""}`}
                  onClick={isClickable ? () => navigateToStep(step.id) : undefined}
                  role={isClickable ? "button" : undefined}
                  tabIndex={isClickable ? 0 : undefined}
                >
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
                    {isCurrent && !overrideStepId && <span className="journey-stepper__badge">En cours</span>}
                    {isCurrent && overrideStepId && <span className="journey-stepper__badge">Consulter</span>}
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
            <div key={`${activeStep.id}-${stepKey}`}>
              {renderStepPanel(activeStep)}
            </div>
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
