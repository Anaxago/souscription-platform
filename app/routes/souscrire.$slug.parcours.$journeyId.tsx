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
      const investor = (await investorRes.json()) as Record<string, unknown>;
      legalEntityKernelId = (investor.legalEntityKernelId as string) ?? null;
      personKernelId = (investor.operatedBy as string) ?? null;
      riskTolerance = (investor.riskTolerance as string) ?? (investor.riskProfile as string) ?? null;
    } else {
      const investor = (await investorRes.json()) as Record<string, unknown>;
      personKernelId = (investor.personKernelId as string) ?? null;
      riskTolerance = (investor.riskTolerance as string) ?? (investor.riskProfile as string) ?? null;
    }

    // If risk profile not yet calculated, trigger recalculation and read from response
    if (!riskTolerance) {
      try {
        const recalcRes = await api(`/individual-investors/${journey.investorId}/recalculate-risk-profile`, { method: "POST" });
        if (recalcRes.ok) {
          const recalc = (await recalcRes.json()) as Record<string, unknown>;
          riskTolerance = (recalc.riskTolerance as string) ?? (recalc.riskProfile as string) ?? null;
        }
      } catch {
        // Non-blocking
      }
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

const ENVELOPE_LABELS: Record<string, string> = {
  AV: "Assurance-vie",
  PER: "PER",
  CTO: "Compte-titres",
  PEA: "PEA",
  PEA_PME: "PEA-PME",
  DIRECT_OWNERSHIP: "Détention directe",
};

function formatEuros(cents: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 0 }).format(cents / 100);
}

function generateOrderRecap(data: {
  orderId: string;
  productName: string;
  investorType: string;
  riskTolerance: string | null;
  envelopeType: string | null;
  amount: number | null;
  steps: { name: string; status: string }[];
  date: string;
  journeyId: string;
  investorId: string;
}) {
  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Récapitulatif de souscription — ${data.productName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #0d2e2b; padding: 48px; line-height: 1.6; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; padding-bottom: 24px; border-bottom: 2px solid #1a5d56; }
    .logo { font-size: 24px; font-weight: 700; color: #1a5d56; }
    .date { font-size: 12px; color: #3d6b66; }
    h1 { font-size: 22px; font-weight: 600; margin-bottom: 8px; }
    .subtitle { font-size: 14px; color: #3d6b66; margin-bottom: 32px; }
    .section { margin-bottom: 28px; }
    .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #3d6b66; margin-bottom: 12px; }
    .table { width: 100%; border-collapse: collapse; }
    .table td { padding: 12px 16px; border-bottom: 1px solid #e0f0ee; font-size: 14px; }
    .table td:first-child { color: #3d6b66; width: 40%; }
    .table td:last-child { font-weight: 600; }
    .order-ref { display: inline-block; background: #e0f0ee; padding: 6px 16px; border-radius: 6px; font-family: monospace; font-size: 13px; color: #1a5d56; font-weight: 600; margin-bottom: 24px; }
    .steps-table { width: 100%; border-collapse: collapse; }
    .steps-table td { padding: 8px 16px; border-bottom: 1px solid #e0f0ee; font-size: 13px; }
    .steps-table td:last-child { text-align: right; }
    .badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; }
    .badge-completed { background: #e0f5e9; color: #1a7a3a; }
    .badge-progress { background: #fef8ec; color: #8a6d2b; }
    .success-box { background: #e0f0ee; border: 1px solid #1a5d56; padding: 20px; border-radius: 8px; text-align: center; margin-bottom: 24px; }
    .success-box h2 { color: #1a5d56; font-size: 18px; margin-bottom: 4px; }
    .success-box p { color: #3d6b66; font-size: 13px; }
    .disclaimer { font-size: 11px; color: #7ab5af; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e0f0ee; line-height: 1.5; }
    @media print { body { padding: 24px; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">Stanza</div>
    <div class="date">${data.date}</div>
  </div>

  <h1>Récapitulatif de souscription</h1>
  <p class="subtitle">Confirmation de votre ordre de souscription</p>

  <div class="success-box">
    <h2>Ordre transmis avec succès</h2>
    <p>Référence : <span class="order-ref">${data.orderId.slice(0, 8)}</span></p>
  </div>

  <div class="section">
    <div class="section-title">Détails de l'investissement</div>
    <table class="table">
      <tr><td>Produit</td><td>${data.productName}</td></tr>
      <tr><td>Type d'investisseur</td><td>${data.investorType === "NATURAL" ? "Personne physique" : "Personne morale"}</td></tr>
      <tr><td>Profil de risque</td><td>${data.riskTolerance ?? "Non évalué"}</td></tr>
      <tr><td>Enveloppe</td><td>${data.envelopeType ?? "—"}</td></tr>
      <tr><td>Montant engagé</td><td>${data.amount != null ? new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 0 }).format(data.amount / 100) : "—"}</td></tr>
    </table>
  </div>

  <div class="section">
    <div class="section-title">Identifiants</div>
    <table class="table">
      <tr><td>Référence ordre</td><td style="font-family:monospace">${data.orderId}</td></tr>
      <tr><td>Parcours</td><td style="font-family:monospace">${data.journeyId}</td></tr>
      <tr><td>Investisseur</td><td style="font-family:monospace">${data.investorId}</td></tr>
    </table>
  </div>

  <div class="section">
    <div class="section-title">Étapes du parcours</div>
    <table class="steps-table">
      ${data.steps.map((s) => `<tr><td>${s.name}</td><td><span class="badge ${s.status === "COMPLETED" ? "badge-completed" : "badge-progress"}">${s.status === "COMPLETED" ? "Complété" : s.status}</span></td></tr>`).join("")}
    </table>
  </div>

  <div class="disclaimer">
    <strong>Avertissement</strong> — Ce document constitue un récapitulatif de votre ordre de souscription.
    Il ne constitue pas un conseil en investissement. L'investissement dans des produits financiers comporte des risques,
    y compris la perte partielle ou totale du capital investi. Les performances passées ne préjugent pas des performances futures.
    <br><br>
    Document généré le ${data.date} par la plateforme Stanza.
  </div>
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank");
  if (win) {
    win.onload = () => setTimeout(() => win.print(), 300);
  }
}

function JourneyCompleted({ journey, marketingProductName, riskTolerance, actionUrl }: { journey: SubscriptionJourney; marketingProductName: string | null; riskTolerance: string | null; actionUrl: string }) {
  const [ordering, setOrdering] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const basket = journey.basket as unknown as {
    lines: { lineType: string; financialInstrumentId?: string | null; shareId?: string | null; requestedAmount: number | null }[];
    envelopeTarget: { targetType?: string; envelopeType?: string; provider?: string | null } | null;
  } | null;

  async function handleCreateOrder() {
    setOrdering(true);
    setError(null);
    try {
      const res = await fetch(actionUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "create-order",
          investorId: journey.investorId,
          investorType: journey.investorType === "LEGAL" ? "LEGAL" : "NATURAL",
          marketingProductId: journey.marketingProductId,
          journeyId: journey.id,
          orderLines: (basket?.lines ?? []).map((line) => ({
            lineType: line.lineType,
            financialInstrumentId: line.financialInstrumentId ?? null,
            shareId: line.shareId ?? null,
            totalAmountAmount: line.requestedAmount ?? 0,
            totalAmountCurrency: "EUR",
          })),
          envelopeTarget: {
            targetType: basket?.envelopeTarget?.targetType ?? "TO_CREATE",
            envelopeType: basket?.envelopeTarget?.envelopeType,
            provider: basket?.envelopeTarget?.provider ?? undefined,
          },
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as Record<string, string>).error ?? `Erreur ${res.status}`);
      }
      const order = await res.json();
      setOrderId((order as { id: string }).id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setOrdering(false);
    }
  }

  const envelopeType = basket?.envelopeTarget?.envelopeType ?? null;
  const amount = basket?.lines?.[0]?.requestedAmount ?? null;
  const applicableSteps = journey.steps.filter((s) => s.isApplicable).sort((a, b) => a.position - b.position);

  function handleDownloadRecap() {
    if (!orderId) return;
    generateOrderRecap({
      orderId,
      productName: marketingProductName ?? "—",
      investorType: journey.investorType === "LEGAL" ? "LEGAL" : "NATURAL",
      riskTolerance: riskTolerance ? (RISK_TOLERANCE_LABELS[riskTolerance] ?? riskTolerance) : null,
      envelopeType: envelopeType ? (ENVELOPE_LABELS[envelopeType] ?? envelopeType) : null,
      amount,
      steps: applicableSteps.map((s) => ({
        name: STEP_TYPE_LABELS[s.stepType] ?? s.stepType,
        status: s.stepStatus,
      })),
      date: new Date().toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }),
      journeyId: journey.id,
      investorId: journey.investorId,
    });
  }

  if (orderId) {
    return (
      <div style={{ padding: "var(--space-2xl) var(--space-xl)", background: "var(--clr-primary-light)", borderRadius: "var(--radius-md)", textAlign: "center" }}>
        <div style={{ width: 72, height: 72, borderRadius: "50%", background: "var(--clr-success-light)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto var(--space-md)" }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--clr-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
        </div>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 300, color: "var(--clr-obsidian)", marginBottom: "var(--space-xs)" }}>Ordre créé</h2>
        <p style={{ fontSize: 15, color: "var(--clr-cashmere)", maxWidth: 420, margin: "0 auto var(--space-sm)" }}>
          Votre ordre de souscription pour <strong>{marketingProductName}</strong> a été transmis avec succès.
        </p>
        <p style={{ fontSize: 13, color: "var(--clr-cashmere)", fontFamily: "monospace", marginBottom: "var(--space-lg)" }}>
          Réf. {orderId.slice(0, 8)}
        </p>

        {/* Summary table */}
        <div style={{ textAlign: "left", border: "1px solid var(--clr-stroke-dark)", borderRadius: "var(--radius-md)", overflow: "hidden", marginBottom: "var(--space-md)" }}>
          {[
            { label: "Produit", value: marketingProductName ?? "—" },
            { label: "Profil de risque", value: riskTolerance ? (RISK_TOLERANCE_LABELS[riskTolerance] ?? riskTolerance) : "Non évalué" },
            { label: "Enveloppe", value: envelopeType ? (ENVELOPE_LABELS[envelopeType] ?? envelopeType) : "—" },
            { label: "Montant engagé", value: amount ? formatEuros(amount) : "—" },
            { label: "Type d'investisseur", value: journey.investorType === "LEGAL" ? "Personne morale" : "Personne physique" },
            { label: "Référence", value: orderId.slice(0, 8) },
          ].map((row, i) => (
            <div key={row.label} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "var(--space-sm) var(--space-md)",
              background: i % 2 === 0 ? "white" : "var(--clr-off-white)",
            }}>
              <span style={{ fontSize: 14, color: "var(--clr-cashmere)", fontWeight: 500 }}>{row.label}</span>
              <span style={{ fontSize: 14, color: "var(--clr-obsidian)", fontWeight: 600 }}>{row.value}</span>
            </div>
          ))}
        </div>

        {/* Download button */}
        <button
          onClick={handleDownloadRecap}
          style={{
            width: "100%", padding: "var(--space-sm)", marginBottom: "var(--space-sm)",
            background: "none", border: "1.5px solid var(--clr-primary)", borderRadius: "var(--radius-pill)",
            color: "var(--clr-primary)", cursor: "pointer", fontSize: 14, fontWeight: 600,
            fontFamily: "var(--font-display)",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Télécharger le récapitulatif
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: "var(--space-2xl) var(--space-xl)", background: "var(--clr-primary-light)", borderRadius: "var(--radius-md)", textAlign: "center" }}>
      <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="var(--clr-primary)" strokeWidth="1.5" style={{ margin: "0 auto var(--space-md)" }}><circle cx="12" cy="12" r="10" /><polyline points="9 12 11 14 15 10" /></svg>
      <h2 style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 300, color: "var(--clr-obsidian)", marginBottom: "var(--space-xs)" }}>Parcours terminé</h2>
      <p style={{ fontSize: 15, color: "var(--clr-cashmere)", maxWidth: 400, margin: "0 auto var(--space-lg)" }}>
        Toutes les étapes sont complétées. Vous pouvez maintenant passer l'ordre de souscription.
      </p>
      {error && <div className="form-error" style={{ marginBottom: "var(--space-md)" }}>{error}</div>}
      <button className="btn-primary" style={{ width: "100%", justifyContent: "center" }} disabled={ordering} onClick={handleCreateOrder}>
        {ordering ? "Création en cours..." : "Passer l'ordre de souscription"}
      </button>
    </div>
  );
}

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
      return <AdequacyCheckStep journeyId={journey.id} stepId={step.id} investorId={journey.investorId} investorType={journey.investorType} financialInstrumentId={marketingProduct?.financialInstrumentId ?? null} productName={marketingProduct?.name ?? null} envelopeType={basketData?.envelopeTarget?.envelopeType ?? null} amount={basketData?.lines?.[0]?.requestedAmount ?? null} state={step.state as { lastCheckId: string | null; result: "ADEQUATE" | "NEUTRAL" | "INADEQUATE" | "INCOMPLETE_PROFILE" | "OVERRIDDEN" | null; overridden: boolean } | null} actionUrl={actionUrl} onComplete={onStepComplete} />;
    }
    if (step.stepType === "DOCUMENT_UPLOAD") {
      return <DocumentUploadStep journeyId={journey.id} stepId={step.id} config={step.config as { requiredDocumentTypes: string[] | null } | null} state={step.state as { uploadedDocuments: { documentId: string; documentType: string; fileName: string; uploadedAt: string }[] } | null} actionUrl={actionUrl} onComplete={onStepComplete} />;
    }
    if (step.stepType === "PRODUCT_SUMMARY") {
      return <ProductSummaryStep journeyId={journey.id} stepId={step.id} investorId={journey.investorId} investorType={journey.investorType} productName={marketingProduct?.name ?? null} riskTolerance={riskTolerance} basket={journey.basket as unknown as { lines: { lineType: string; requestedAmount: number | null }[]; envelopeTarget: { envelopeType: string; provider: string | null } | null } | null} actionUrl={actionUrl} onComplete={onStepComplete} />;
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
          {revalidator.state === "loading" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "var(--space-2xl) 0", gap: "var(--space-md)" }}>
              <div style={{ position: "relative", width: 48, height: 48 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: "50%",
                  border: "3px solid var(--clr-mauve)",
                  borderTopColor: "var(--clr-primary)",
                  animation: "stanzia-spin 0.8s linear infinite",
                }} />
              </div>
              <span style={{
                fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600,
                color: "var(--clr-primary)", letterSpacing: "0.02em",
              }}>
                Stanza
              </span>
              <style>{`@keyframes stanzia-spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}
          {revalidator.state !== "loading" && activeStep && activeStep.stepStatus !== "COMPLETED" && (
            <div key={`${activeStep.id}-${stepKey}`}>
              {renderStepPanel(activeStep)}
            </div>
          )}

          {/* Journey completed — create order */}
          {journey.status === "COMPLETED" && (
            <JourneyCompleted journey={journey} marketingProductName={marketingProduct?.name ?? null} riskTolerance={riskTolerance} actionUrl={actionUrl} />
          )}
        </section>
      </main>
    </div>
  );
}
