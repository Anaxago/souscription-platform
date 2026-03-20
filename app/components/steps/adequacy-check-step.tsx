import { useState, useEffect } from "react";

interface Props {
  journeyId: string;
  stepId: string;
  investorId: string;
  investorType: string;
  financialInstrumentId: string | null;
  productName: string | null;
  envelopeType: string | null;
  amount: number | null;
  state: AdequacyState | null;
  actionUrl: string;
  onComplete: () => void;
  investorDisplayName?: string | null;
  investorEmail?: string | null;
  investorPhone?: string | null;
  riskTolerance?: string | null;
}

interface AdequacyState {
  lastCheckId: string | null;
  result: "ADEQUATE" | "NEUTRAL" | "INADEQUATE" | "INCOMPLETE_PROFILE" | "OVERRIDDEN" | null;
  overridden: boolean;
}

interface CriterionResult {
  criterionType: string;
  investorValue: string | null;
  adequacy: "POSITIVE" | "NEUTRAL" | "NEGATIVE" | "MISSING";
}

const CRITERION_LABELS: Record<string, string> = {
  MIFID_CLASSIFICATION: "Classification MiFID",
  FINANCIAL_KNOWLEDGE: "Connaissances financières",
  FINANCIAL_EXPERIENCE: "Expérience financière",
  RISK_PROFILE: "Profil de risque",
  RISK_TOLERANCE: "Tolérance au risque",
  LOSS_CAPACITY: "Capacité de perte",
  INVESTMENT_HORIZON: "Horizon d'investissement",
  INVESTMENT_OBJECTIVE: "Objectif d'investissement",
  ESG_PREFERENCE: "Préférence ESG",
  TAXONOMY_PREFERENCE: "Préférence Taxonomie",
  PAI_CONSIDERATION: "Prise en compte des PAI",
  US_PERSON: "US Person",
  AGE_OVER_65: "Plus de 65 ans",
  KNOWLEDGE_LEVEL: "Niveau de connaissance",
  EXPERIENCE: "Expérience",
  FINANCIAL_SITUATION: "Situation financière",
};

const INVESTOR_VALUE_LABELS: Record<string, string> = {
  // Knowledge & experience
  EXPERIENCED: "Expérimenté",
  INTERMEDIATE: "Intermédiaire",
  NOVICE: "Débutant",
  PROFESSIONAL: "Professionnel",
  INFORMED: "Averti",
  RETAIL: "Non professionnel",
  // Risk profile
  CONSERVATIVE: "Prudent",
  MODERATE: "Modéré",
  BALANCED: "Équilibré",
  DYNAMIC: "Dynamique",
  AGGRESSIVE: "Offensif",
  // Horizon
  SHORT: "Court terme",
  MEDIUM: "Moyen terme",
  LONG: "Long terme",
  // Loss capacity
  NO_LOSS: "Aucune perte",
  LIMITED_LOSS: "Perte limitée",
  PARTIAL_LOSS: "Perte partielle",
  TOTAL_LOSS: "Perte totale possible",
  NO_GUARANTEE: "Sans garantie de capital",
  // Objectives
  CAPITAL_PRESERVATION: "Préservation du capital",
  INCOME_GENERATION: "Génération de revenus",
  MODERATE_GROWTH: "Croissance modérée",
  HIGH_GROWTH: "Forte croissance",
  MAXIMUM_RETURNS: "Rendement maximum",
  // ESG / Taxonomy / PAI
  INTERESTED: "Intéressé",
  NOT_INTERESTED: "Non intéressé",
  CONSIDERS: "Pris en compte",
  DOES_NOT_CONSIDER: "Non pris en compte",
  CONSIDERS_PAI: "Pris en compte",
  // Boolean
  TRUE: "Oui",
  FALSE: "Non",
};

const ADEQUACY_BADGE: Record<string, { label: string; bg: string; color: string; border: string }> = {
  POSITIVE: { label: "Positif", bg: "#e0f5e9", color: "#1a7a3a", border: "#1a7a3a" },
  NEUTRAL: { label: "Neutre", bg: "#fef8ec", color: "#8a6d2b", border: "#d4a843" },
  NEGATIVE: { label: "Négatif", bg: "#fde8e8", color: "#b91c1c", border: "#b91c1c" },
  MISSING: { label: "Manquant", bg: "#f3f4f6", color: "#6b7280", border: "#9ca3af" },
};

const RESULT_CONFIG: Record<string, { label: string; desc: string; color: string; bgColor: string }> = {
  ADEQUATE: { label: "Adéquat", desc: "Ce produit est adapté à votre profil investisseur.", color: "var(--clr-primary)", bgColor: "var(--clr-primary-light)" },
  NEUTRAL: { label: "Neutre", desc: "Les informations disponibles ne permettent pas de confirmer pleinement l'adéquation. Vous pouvez poursuivre.", color: "var(--clr-warning)", bgColor: "var(--clr-warning-light)" },
  INADEQUATE: { label: "Inadéquat", desc: "Ce produit ne correspond pas à votre profil. Vous pouvez continuer en acceptant les risques.", color: "var(--clr-error)", bgColor: "var(--clr-error-light)" },
  INCOMPLETE_PROFILE: { label: "Profil incomplet", desc: "Veuillez compléter votre profil investisseur pour effectuer ce contrôle.", color: "var(--clr-error)", bgColor: "var(--clr-error-light)" },
  OVERRIDDEN: { label: "Dérogation acceptée", desc: "Vous avez accepté de poursuivre malgré l'inadéquation.", color: "var(--clr-cashmere)", bgColor: "var(--clr-ecru-bg)" },
};

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

function generatePdfReport(data: {
  productName: string;
  envelopeType: string;
  amount: string;
  investorType: string;
  investorName: string;
  investorEmail: string;
  investorPhone: string;
  riskTolerance: string | null;
  result: string;
  resultLabel: string;
  resultDesc: string;
  criteria: CriterionResult[];
  date: string;
}) {
  const RISK_LEVELS = ["CONSERVATIVE", "MODERATE", "BALANCED", "DYNAMIC", "AGGRESSIVE"];
  const RISK_LABELS_PDF: Record<string, { label: string; desc: string }> = {
    CONSERVATIVE: { label: "Prudent", desc: "Vous acceptez de faibles variations de rendements et tolérez des pertes occasionnelles en capital." },
    MODERATE: { label: "Modéré", desc: "Vous acceptez des variations modérées et tolérez des pertes faibles pour une meilleure rentabilité." },
    BALANCED: { label: "Équilibré", desc: "Vous acceptez des variations modérées et tolérez des pertes faibles pour une meilleure rentabilité attendue." },
    DYNAMIC: { label: "Dynamique", desc: "Vous acceptez de fortes variations de rendement et des pertes modérées en vue de tirer la meilleure rentabilité." },
    AGGRESSIVE: { label: "Offensif", desc: "Vous acceptez de fortes variations et de fortes pertes en capital car vous privilégiez la rentabilité." },
  };

  const riskIdx = data.riskTolerance ? RISK_LEVELS.indexOf(data.riskTolerance) : -1;
  const riskInfo = data.riskTolerance ? RISK_LABELS_PDF[data.riskTolerance] : null;

  // Extract specific criteria values for the profile section
  const getCriterionValue = (type: string) => {
    const c = data.criteria.find((cr) => cr.criterionType === type);
    return c?.investorValue ? (INVESTOR_VALUE_LABELS[c.investorValue] ?? c.investorValue) : null;
  };

  const riskGaugeBars = RISK_LEVELS.map((_, i) =>
    `<div style="flex:1;height:8px;border-radius:4px;background:${i <= riskIdx ? "#1a5d56" : "#d1d5db"}"></div>`
  ).join("");

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Rapport d'adéquation — ${data.productName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #0d2e2b; line-height: 1.6; }
    @page { size: A4; margin: 2cm; }
    .page { page-break-after: always; padding: 0; }
    .page:last-child { page-break-after: avoid; }

    /* Cover */
    .cover { display: flex; flex-direction: column; justify-content: center; align-items: center; min-height: 80vh; text-align: center; }
    .cover-logo { font-size: 36px; font-weight: 700; color: #1a5d56; letter-spacing: -0.02em; margin-bottom: 12px; }
    .cover-subtitle { font-size: 14px; color: #3d6b66; font-style: italic; margin-bottom: 48px; }
    .cover-title { font-size: 28px; font-weight: 600; color: #0d2e2b; margin-bottom: 16px; }
    .cover-investor { font-size: 18px; color: #1a5d56; font-weight: 600; padding: 8px 24px; background: #fffacd; display: inline-block; margin-bottom: 48px; }
    .cover-date { font-size: 13px; color: #7ab5af; }

    /* Common */
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; padding-bottom: 16px; border-bottom: 2px solid #1a5d56; }
    .logo { font-size: 20px; font-weight: 700; color: #1a5d56; }
    .date { font-size: 11px; color: #7ab5af; }
    .page-num { font-size: 10px; color: #7ab5af; text-align: center; margin-top: 32px; }
    h1 { font-size: 20px; font-weight: 600; color: #0d2e2b; margin-bottom: 6px; }
    h2 { font-size: 16px; font-weight: 600; color: #0d2e2b; margin-bottom: 12px; }
    .subtitle { font-size: 13px; color: #3d6b66; margin-bottom: 24px; }
    .section { margin-bottom: 24px; }
    .section-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #3d6b66; margin-bottom: 10px; }
    p { font-size: 13px; margin-bottom: 12px; }

    /* Tables */
    .table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    .table td, .table th { padding: 10px 14px; border-bottom: 1px solid #e0f0ee; font-size: 13px; text-align: left; }
    .table td:first-child, .table th:first-child { color: #3d6b66; }
    .table td:last-child { font-weight: 600; }
    .table-bordered { border: 1px solid #e0f0ee; border-radius: 6px; overflow: hidden; }
    .table-bordered td, .table-bordered th { border: 1px solid #e0f0ee; }

    /* Two column */
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
    .two-col .col { border: 1px solid #e0f0ee; border-radius: 6px; padding: 16px; }
    .col-title { font-size: 13px; font-weight: 700; color: #0d2e2b; margin-bottom: 8px; }
    .col-row { font-size: 12px; color: #3d6b66; margin-bottom: 4px; }
    .col-row strong { color: #0d2e2b; }

    /* Result */
    .result-box { padding: 16px; border-radius: 8px; margin-bottom: 16px; }
    .result-box.adequate { background: #e0f0ee; border: 1px solid #1a5d56; }
    .result-box.neutral { background: #fef8ec; border: 1px solid #e6a032; }
    .result-box.inadequate, .result-box.overridden { background: #fdf2f2; border: 1px solid #c0392b; }
    .result-label { font-size: 15px; font-weight: 700; margin-bottom: 4px; }
    .result-desc { font-size: 12px; color: #3d6b66; }

    /* Badges */
    .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 600; }
    .badge-positive { background: #e0f5e9; color: #1a7a3a; border: 1px solid #1a7a3a; }
    .badge-neutral { background: #fef8ec; color: #8a6d2b; border: 1px solid #d4a843; }
    .badge-negative { background: #fde8e8; color: #b91c1c; border: 1px solid #b91c1c; }
    .badge-missing { background: #f3f4f6; color: #6b7280; border: 1px solid #9ca3af; }

    /* Risk gauge */
    .gauge { display: flex; gap: 4px; width: 200px; margin: 8px 0; }
    .gauge-label { font-size: 12px; font-weight: 600; color: #1a5d56; }

    /* Adequacy matrix */
    .matrix td { font-size: 12px; padding: 8px 10px; }
    .matrix th { font-size: 10px; padding: 8px 10px; text-transform: uppercase; letter-spacing: 0.03em; color: #7ab5af; font-weight: 600; }

    .footer { font-size: 9px; color: #7ab5af; text-align: center; margin-top: 24px; padding-top: 12px; border-top: 1px solid #e0f0ee; line-height: 1.4; }
    .disclaimer { font-size: 10px; color: #7ab5af; line-height: 1.5; margin-top: 16px; padding: 12px; background: #f9fafb; border-radius: 6px; }

    @media print { .page { page-break-after: always; } .page:last-child { page-break-after: avoid; } }
  </style>
</head>
<body>

<!-- ═══ PAGE 1: COVER ═══ -->
<div class="page">
  <div class="cover">
    <div class="cover-logo">Stanza</div>
    <div class="cover-subtitle">Plateforme d'investissement alternatif</div>
    <div class="cover-title">RAPPORT D'ADÉQUATION</div>
    <div class="cover-investor">${data.investorName}</div>
    <div class="cover-date">${data.date}</div>
    <div style="margin-top:24px;font-size:12px;color:#7ab5af;">
      Directive MiFID II / DDA — Test d'adéquation réglementaire
    </div>
  </div>
</div>

<!-- ═══ PAGE 2: INTRODUCTION + IDENTITÉ ═══ -->
<div class="page">
  <div class="header"><div class="logo">Stanza</div><div class="date">${data.date}</div></div>

  <div class="section">
    <p>Cher(e) ${data.investorName},</p>
    <p>Dans le cadre de votre projet d'investissement, Stanza a procédé à l'évaluation de l'adéquation du produit financier envisagé avec votre profil investisseur.</p>
    <p>Ce rapport est établi conformément aux obligations réglementaires (Directive MiFID II / DDA). Il prend en compte votre situation patrimoniale et financière, vos objectifs et horizon d'investissement, votre niveau de connaissance et d'expérience en matière financière, votre tolérance au risque, votre capacité à subir des pertes ainsi que vos préférences en matière de durabilité.</p>
    <p>Nous vous en souhaitons bonne réception et restons à votre disposition pour tout complément d'informations.</p>
  </div>

  <div class="section">
    <div class="section-title">Identité</div>
    <div class="two-col">
      <div class="col">
        <div class="col-title">L'investisseur</div>
        <div class="col-row">Nom : <strong>${data.investorName}</strong></div>
        <div class="col-row">Email : <strong>${data.investorEmail}</strong></div>
        <div class="col-row">Téléphone : <strong>${data.investorPhone}</strong></div>
        <div class="col-row">Type : <strong>${data.investorType === "NATURAL" ? "Personne physique" : "Personne morale"}</strong></div>
      </div>
      <div class="col">
        <div class="col-title">La plateforme</div>
        <div class="col-row">Société : <strong>Stanza</strong></div>
        <div class="col-row">Statut : <strong>CIF / COA</strong></div>
        <div class="col-row">Date du rapport : <strong>${data.date}</strong></div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Détails de la souscription</div>
    <table class="table">
      <tr><td>Produit</td><td>${data.productName}</td></tr>
      <tr><td>Enveloppe</td><td>${data.envelopeType}</td></tr>
      <tr><td>Montant engagé</td><td>${data.amount}</td></tr>
      <tr><td>Type d'investisseur</td><td>${data.investorType === "NATURAL" ? "Personne physique" : "Personne morale"}</td></tr>
    </table>
  </div>

  <div class="footer">Stanza — Rapport d'adéquation — ${data.date} — Page 2</div>
</div>

<!-- ═══ PAGE 3: PROFIL INVESTISSEUR ═══ -->
<div class="page">
  <div class="header"><div class="logo">Stanza</div><div class="date">${data.date}</div></div>
  <h1>VOTRE PROFIL D'INVESTISSEUR</h1>
  <p class="subtitle">Synthèse de votre profil établi sur la base de vos réponses au questionnaire de connaissance client.</p>

  <div class="section">
    <table class="table">
      ${getCriterionValue("MIFID_CLASSIFICATION") ? `<tr><td>Classification MiFID</td><td>${getCriterionValue("MIFID_CLASSIFICATION")}</td></tr>` : ""}
      ${getCriterionValue("FINANCIAL_KNOWLEDGE") ? `<tr><td>Connaissances financières</td><td>${getCriterionValue("FINANCIAL_KNOWLEDGE")}</td></tr>` : ""}
      ${getCriterionValue("FINANCIAL_EXPERIENCE") ? `<tr><td>Expérience financière</td><td>${getCriterionValue("FINANCIAL_EXPERIENCE")}</td></tr>` : ""}
      ${getCriterionValue("LOSS_CAPACITY") ? `<tr><td>Capacité à subir des pertes</td><td>${getCriterionValue("LOSS_CAPACITY")}</td></tr>` : ""}
      ${getCriterionValue("INVESTMENT_HORIZON") ? `<tr><td>Horizon de placement</td><td>${getCriterionValue("INVESTMENT_HORIZON")}</td></tr>` : ""}
      ${getCriterionValue("INVESTMENT_OBJECTIVE") ? `<tr><td>Objectif d'investissement</td><td>${getCriterionValue("INVESTMENT_OBJECTIVE")}</td></tr>` : ""}
    </table>
  </div>

  ${riskInfo ? `
  <div class="section">
    <div class="section-title">Votre profil de risque</div>
    <div style="padding:16px;border:1px solid #e0f0ee;border-radius:8px;background:#f9fafb;">
      <div class="gauge-label">${riskInfo.label} (${riskIdx + 1}/5)</div>
      <div class="gauge">${riskGaugeBars}</div>
      <p style="font-size:12px;color:#3d6b66;margin:8px 0 0;">${riskInfo.desc}</p>
    </div>
  </div>` : ""}

  <div class="section">
    <div class="section-title">Préférences en matière de durabilité</div>
    <table class="table">
      ${getCriterionValue("ESG_PREFERENCE") ? `<tr><td>Investissement ESG (SFDR 2019/2088)</td><td>${getCriterionValue("ESG_PREFERENCE")}</td></tr>` : ""}
      ${getCriterionValue("TAXONOMY_PREFERENCE") ? `<tr><td>Alignement Taxonomie (2020/852)</td><td>${getCriterionValue("TAXONOMY_PREFERENCE")}</td></tr>` : ""}
      ${getCriterionValue("PAI_CONSIDERATION") ? `<tr><td>Prise en compte des PAI</td><td>${getCriterionValue("PAI_CONSIDERATION")}</td></tr>` : ""}
    </table>
  </div>

  <div class="disclaimer">
    <strong>Gestion des risques</strong> — Il est généralement admis qu'un investissement présentant un risque de perte en capital ne doit pas à lui seul représenter plus de 5 % à 10 % du patrimoine financier d'un investisseur et ne doit excéder une année de capacité d'épargne.
  </div>

  <div class="footer">Stanza — Rapport d'adéquation — ${data.date} — Page 3</div>
</div>

<!-- ═══ PAGE 4: JUSTIFICATION DE L'ADÉQUATION ═══ -->
<div class="page">
  <div class="header"><div class="logo">Stanza</div><div class="date">${data.date}</div></div>
  <h1>JUSTIFICATION DE L'ADÉQUATION</h1>
  <p class="subtitle">Matrice d'adéquation du produit recommandé avec votre profil investisseur, basée sur les informations communiquées et les caractéristiques du produit (marché cible).</p>

  <div class="section">
    <div class="section-title">Résultat global</div>
    <div class="result-box ${data.result.toLowerCase()}">
      <div class="result-label" style="color: ${data.result === "ADEQUATE" ? "#1a5d56" : data.result === "NEUTRAL" ? "#e6a032" : "#c0392b"}">${data.resultLabel}</div>
      <div class="result-desc">${data.resultDesc}</div>
    </div>
  </div>

  ${data.criteria.length > 0 ? `
  <div class="section">
    <div class="section-title">Détail par critère (${data.criteria.length})</div>
    <div class="table-bordered">
      <table class="table matrix" style="margin:0">
        <thead><tr><th style="width:45%">Critère</th><th style="width:30%">Valeur investisseur</th><th style="width:25%;text-align:right">Résultat</th></tr></thead>
        <tbody>
          ${data.criteria.map((c) => {
            const badgeClass = c.adequacy === "POSITIVE" ? "badge-positive" : c.adequacy === "NEGATIVE" ? "badge-negative" : c.adequacy === "NEUTRAL" ? "badge-neutral" : "badge-missing";
            const badgeLabel = c.adequacy === "POSITIVE" ? "Positif" : c.adequacy === "NEGATIVE" ? "Négatif" : c.adequacy === "NEUTRAL" ? "Neutre" : "Manquant";
            const val = c.investorValue ? (INVESTOR_VALUE_LABELS[c.investorValue] ?? c.investorValue) : "—";
            return `<tr><td>${CRITERION_LABELS[c.criterionType] ?? c.criterionType}</td><td style="font-weight:600">${val}</td><td style="text-align:right"><span class="badge ${badgeClass}">${badgeLabel}</span></td></tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>
  </div>` : ""}

  ${data.result === "INADEQUATE" || data.result === "OVERRIDDEN" ? `
  <div class="disclaimer">
    <strong>Déclaration</strong> — La souscription envisagée n'est pas totalement en adéquation avec le profil de l'investisseur. L'investisseur a été informé de cette inadéquation et a confirmé sa volonté de poursuivre l'investissement en acceptant les risques associés.
  </div>` : ""}

  <div class="footer">Stanza — Rapport d'adéquation — ${data.date} — Page 4</div>
</div>

<!-- ═══ PAGE 5: AVERTISSEMENTS & SIGNATURE ═══ -->
<div class="page">
  <div class="header"><div class="logo">Stanza</div><div class="date">${data.date}</div></div>
  <h1>AVERTISSEMENTS RÉGLEMENTAIRES</h1>

  <div class="disclaimer" style="margin-bottom:24px;">
    <strong>Avertissement</strong> — Ce rapport est généré automatiquement dans le cadre de l'obligation réglementaire de test d'adéquation (MiFID II / DDA). Il ne constitue pas un conseil en investissement personnalisé. Les performances passées ne préjugent pas des performances futures. L'investissement dans des produits financiers comporte des risques, y compris la perte partielle ou totale du capital investi.
  </div>

  <div class="disclaimer" style="margin-bottom:24px;">
    <strong>Risque de perte en capital</strong> — Les investissements proposés présentent un risque de perte en capital. Le capital investi n'est pas garanti. L'investisseur peut perdre tout ou partie de son investissement initial.
  </div>

  <div class="disclaimer" style="margin-bottom:24px;">
    <strong>Risque d'illiquidité</strong> — Les produits d'investissement alternatif sont généralement illiquides. Il peut être difficile, voire impossible, de revendre ou de transférer les participations avant l'échéance prévue.
  </div>

  <div class="section" style="margin-top:48px;">
    <div class="section-title">Date et signature</div>
    <div class="two-col">
      <div class="col">
        <div class="col-title">L'investisseur</div>
        <div class="col-row">Nom : ${data.investorName}</div>
        <div class="col-row">Date : ${data.date}</div>
        <div style="margin-top:40px;border-bottom:1px solid #3d6b66;width:200px;"></div>
        <div class="col-row" style="margin-top:4px;font-style:italic;">Signature</div>
      </div>
      <div class="col">
        <div class="col-title">La plateforme</div>
        <div class="col-row">Stanza</div>
        <div class="col-row">Date : ${data.date}</div>
        <div style="margin-top:40px;border-bottom:1px solid #3d6b66;width:200px;"></div>
        <div class="col-row" style="margin-top:4px;font-style:italic;">Signature</div>
      </div>
    </div>
  </div>

  <div class="footer" style="margin-top:auto;">
    Document généré le ${data.date} par la plateforme Stanza.<br>
    Ce document est confidentiel et destiné exclusivement à l'investisseur désigné.
  </div>
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

export default function AdequacyCheckStep({
  journeyId,
  stepId,
  investorId,
  investorType,
  financialInstrumentId,
  productName,
  envelopeType,
  amount,
  state,
  actionUrl,
  onComplete,
  investorDisplayName,
  investorEmail,
  investorPhone,
  riskTolerance,
}: Props) {
  const [checking, setChecking] = useState(false);
  const [overriding, setOverriding] = useState(false);
  const [result, setResult] = useState<string | null>(state?.result ?? null);
  const [lastCheckId, setLastCheckId] = useState<string | null>(state?.lastCheckId ?? null);
  const [criteria, setCriteria] = useState<CriterionResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [autoLaunched, setAutoLaunched] = useState(false);

  async function callAction(payload: Record<string, unknown>) {
    const res = await fetch(actionUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as Record<string, string>).error ?? `Erreur ${res.status}`);
    }
    return res.json();
  }

  // Auto-launch evaluation or fetch existing criteria on mount
  useEffect(() => {
    if (!result && !autoLaunched) {
      setAutoLaunched(true);
      handleEvaluate();
    } else if (result && lastCheckId && criteria.length === 0) {
      // Result already exists — fetch criteria details
      callAction({ type: "fetch-adequacy-check", investorId, financialInstrumentId: financialInstrumentId ?? "" })
        .then((check) => {
          const details = (check as { details?: { criteriaResults?: CriterionResult[] } }).details;
          if (details?.criteriaResults) setCriteria(details.criteriaResults);
        })
        .catch(() => { /* non-blocking */ });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleEvaluate() {
    setChecking(true);
    setError(null);
    try {
      const journey = await callAction({
        type: "evaluate-adequacy",
        journeyId,
        stepId,
        investorType: investorType === "NATURAL" ? "INDIVIDUAL" : "LEGAL_ENTITY",
      });
      const updatedStep = (journey as { steps: { id: string; state: AdequacyState }[] }).steps?.find(
        (s: { id: string }) => s.id === stepId,
      );
      if (updatedStep?.state) {
        setResult(updatedStep.state.result);
        setLastCheckId(updatedStep.state.lastCheckId);
        // Fetch detailed criteria results
        if (updatedStep.state.lastCheckId) {
          try {
            const check = await callAction({ type: "fetch-adequacy-check", investorId, financialInstrumentId: financialInstrumentId ?? "" });
            const details = (check as { details?: { criteriaResults?: CriterionResult[] } }).details;
            if (details?.criteriaResults) {
              setCriteria(details.criteriaResults);
            }
          } catch {
            // Non-blocking — details are optional
          }
        }
      }
      // Always show results — user clicks "Continuer" to proceed
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setChecking(false);
    }
  }

  async function handleOverride() {
    if (!lastCheckId) return;
    setOverriding(true);
    setError(null);
    try {
      await callAction({
        type: "override-adequacy",
        checkId: lastCheckId,
        journeyId,
        stepId,
      });
      onComplete();
    } catch {
      // Check might already be overridden — try completing the step directly
      try {
        await callAction({ type: "complete", journeyId, stepId });
        onComplete();
      } catch (e2) {
        setError(e2 instanceof Error ? e2.message : "Erreur");
      }
    } finally {
      setOverriding(false);
    }
  }

  function handleDownloadReport() {
    const resultInfo = result ? RESULT_CONFIG[result] : null;
    generatePdfReport({
      productName: productName ?? "—",
      envelopeType: envelopeType ? (ENVELOPE_LABELS[envelopeType] ?? envelopeType) : "—",
      amount: amount ? formatEuros(amount) : "—",
      investorType,
      investorName: investorDisplayName ?? "—",
      investorEmail: investorEmail ?? "—",
      investorPhone: investorPhone ?? "—",
      riskTolerance: riskTolerance ?? null,
      result: result ?? "UNKNOWN",
      resultLabel: resultInfo?.label ?? "—",
      resultDesc: resultInfo?.desc ?? "—",
      criteria,
      date: new Date().toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }),
    });
  }

  const resultInfo = result ? RESULT_CONFIG[result] : null;
  const envelopeLabel = envelopeType ? (ENVELOPE_LABELS[envelopeType] ?? envelopeType) : null;

  return (
    <div className="step-panel">
      <div className="step-panel__header">
        <div className="step-panel__icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--clr-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </div>
        <div>
          <h2 className="step-panel__title">Test d'adéquation</h2>
          <p className="step-panel__desc">
            Vérification réglementaire que ce produit est adapté à votre profil.
          </p>
        </div>
      </div>

      {error && <div className="form-error" style={{ marginBottom: "var(--space-md)" }}>{error}</div>}

      {/* Recap before or after evaluation */}
      <div style={{
        display: "flex", flexDirection: "column", gap: 0,
        border: "1px solid var(--clr-stroke-dark)", borderRadius: "var(--radius-md)",
        overflow: "hidden", marginBottom: "var(--space-lg)",
      }}>
        {[
          { label: "Produit", value: productName ?? "—" },
          { label: "Enveloppe", value: envelopeLabel ?? "—" },
          { label: "Montant engagé", value: amount ? formatEuros(amount) : "—" },
          { label: "Type", value: investorType === "NATURAL" ? "Personne physique" : "Personne morale" },
        ].map((row, i) => (
          <div key={row.label} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "var(--space-sm) var(--space-md)",
            background: i % 2 === 0 ? "var(--clr-off-white)" : "white",
          }}>
            <span style={{ fontSize: 14, color: "var(--clr-cashmere)", fontWeight: 500 }}>{row.label}</span>
            <span style={{ fontSize: 15, color: "var(--clr-obsidian)", fontWeight: 600 }}>{row.value}</span>
          </div>
        ))}
      </div>

      {/* No result yet — run the check */}
      {!result && (
        <button className="btn-primary" style={{ width: "100%", justifyContent: "center" }} disabled={checking} onClick={handleEvaluate}>
          {checking ? "Analyse en cours..." : "Lancer le test d'adéquation"}
        </button>
      )}

      {/* Result display */}
      {result && resultInfo && (
        <>
          <div style={{
            padding: "var(--space-md)",
            borderRadius: "var(--radius-md)",
            border: `1px solid ${resultInfo.color}`,
            background: resultInfo.bgColor,
            marginBottom: "var(--space-md)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              {(result === "ADEQUATE" || result === "OVERRIDDEN") && (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--clr-primary)" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
              )}
              {result === "NEUTRAL" && (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--clr-warning)" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
              )}
              {(result === "INADEQUATE" || result === "INCOMPLETE_PROFILE") && (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--clr-error)" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
              )}
              <span style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 600, color: resultInfo.color }}>
                {resultInfo.label}
              </span>
            </div>
            <p style={{ fontSize: 14, color: "var(--clr-cashmere)", margin: 0 }}>
              {resultInfo.desc}
            </p>
          </div>

          {/* Detailed criteria table */}
          {criteria.length > 0 && (
            <div style={{
              border: "1px solid var(--clr-stroke-dark)", borderRadius: "var(--radius-md)",
              overflow: "hidden", marginBottom: "var(--space-md)",
            }}>
              <div style={{ padding: "var(--space-sm) var(--space-md)", background: "var(--clr-off-white)", borderBottom: "1px solid var(--clr-stroke-dark)" }}>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--clr-cashmere)" }}>
                  Détail par critère ({criteria.length})
                </span>
              </div>
              {/* Header */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 180px 80px", padding: "var(--space-xs) var(--space-md)", borderBottom: "1px solid var(--clr-stroke-dark)", background: "var(--clr-off-white)" }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--clr-cashmere)", textTransform: "uppercase", letterSpacing: "0.03em" }}>Critère</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--clr-cashmere)", textTransform: "uppercase", letterSpacing: "0.03em" }}>Valeur</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--clr-cashmere)", textTransform: "uppercase", letterSpacing: "0.03em", textAlign: "right" }}>Résultat</span>
              </div>
              {criteria.map((c, i) => {
                const badge = ADEQUACY_BADGE[c.adequacy] ?? ADEQUACY_BADGE.MISSING;
                const valueLabel = c.investorValue ? (INVESTOR_VALUE_LABELS[c.investorValue] ?? c.investorValue) : "—";
                return (
                  <div key={CRITERION_LABELS[c.criterionType] ?? c.criterionType} style={{
                    display: "grid", gridTemplateColumns: "1fr 180px 80px", alignItems: "center",
                    padding: "var(--space-sm) var(--space-md)",
                    borderBottom: i < criteria.length - 1 ? "1px solid var(--clr-stroke-dark)" : undefined,
                    background: i % 2 === 0 ? "white" : "var(--clr-off-white)",
                  }}>
                    <span style={{ fontSize: 14, color: "var(--clr-obsidian)" }}>
                      {CRITERION_LABELS[c.criterionType] ?? c.criterionType}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--clr-obsidian)" }}>
                      {valueLabel}
                    </span>
                    <span style={{
                      fontSize: 12, fontWeight: 600, padding: "2px 10px", borderRadius: 12,
                      background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`,
                      textAlign: "center", whiteSpace: "nowrap",
                    }}>
                      {badge.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Download report button */}
          <button
            onClick={handleDownloadReport}
            style={{
              width: "100%", padding: "var(--space-sm)", marginBottom: "var(--space-md)",
              background: "none", border: "1.5px solid var(--clr-primary)", borderRadius: "var(--radius-pill)",
              color: "var(--clr-primary)", cursor: "pointer", fontSize: 14, fontWeight: 600,
              fontFamily: "var(--font-display)",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              transition: "background-color 0.2s ease, color 0.2s ease",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--clr-primary-light)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Télécharger le rapport d'adéquation
          </button>
        </>
      )}

      {/* Actions based on result */}
      {result === "NEUTRAL" && (
        <button className="btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={() => onComplete()}>
          Continuer malgré l'avertissement
        </button>
      )}

      {result === "INADEQUATE" && (
        <>
          {/* Advisor card */}
          <div style={{
            border: "1px solid var(--clr-stroke-dark)", borderRadius: "var(--radius-md)",
            padding: "var(--space-md)", marginBottom: "var(--space-md)",
            display: "flex", gap: "var(--space-md)", alignItems: "center",
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: "50%", background: "var(--clr-primary)",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--clr-obsidian)" }}>Votre conseiller Stanza</div>
              <div style={{ fontSize: 13, color: "var(--clr-cashmere)" }}>
                Ce produit ne correspond pas entièrement à votre profil. Un conseiller peut vous accompagner dans votre démarche.
              </div>
            </div>
            <button
              onClick={() => window.open("https://calendly.com/stanza-conseil", "_blank")}
              style={{
                padding: "8px 16px", background: "var(--clr-primary)", color: "white", border: "none",
                borderRadius: "var(--radius-pill)", fontSize: 13, fontWeight: 600,
                fontFamily: "var(--font-display)", cursor: "pointer", whiteSpace: "nowrap",
              }}
            >
              Prendre RDV
            </button>
          </div>

          <button className="btn-primary" style={{ width: "100%", justifyContent: "center" }} disabled={overriding} onClick={handleOverride}>
            {overriding ? "..." : "J'accepte les risques et je souhaite continuer"}
          </button>
        </>
      )}

      {(result === "ADEQUATE" || result === "OVERRIDDEN") && (
        <button className="btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={() => onComplete()}>
          Continuer
        </button>
      )}

      {result === "INCOMPLETE_PROFILE" && (
        <p style={{ fontSize: 14, color: "var(--clr-error)", textAlign: "center" }}>
          Veuillez revenir à l'étape "Profil investisseur" pour compléter vos informations.
        </p>
      )}
    </div>
  );
}
