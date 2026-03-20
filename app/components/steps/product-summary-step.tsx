import { useState } from "react";

interface Props {
  journeyId: string;
  stepId: string;
  investorId: string;
  investorType: string;
  productName: string | null;
  riskTolerance: string | null;
  basket: {
    lines: { lineType: string; requestedAmount: number | null }[];
    envelopeTarget: { envelopeType: string; provider: string | null } | null;
  } | null;
  actionUrl: string;
  onComplete: () => void;
}

const RISK_LEVELS: { key: string; label: string }[] = [
  { key: "CONSERVATIVE", label: "Prudent" },
  { key: "MODERATE", label: "Modéré" },
  { key: "BALANCED", label: "Équilibré" },
  { key: "DYNAMIC", label: "Dynamique" },
  { key: "AGGRESSIVE", label: "Offensif" },
];

function RiskGauge({ level }: { level: string }) {
  const idx = RISK_LEVELS.findIndex((r) => r.key === level);
  const active = idx >= 0 ? idx + 1 : 0;
  const label = idx >= 0 ? RISK_LEVELS[idx].label : level;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
      <span style={{ fontSize: 14, fontWeight: 600, color: "var(--clr-obsidian)" }}>
        {label} ({active}/{RISK_LEVELS.length})
      </span>
      <div style={{ display: "flex", gap: 3 }}>
        {RISK_LEVELS.map((r, i) => (
          <div
            key={r.key}
            style={{
              width: 24,
              height: 8,
              borderRadius: 4,
              background: i < active ? "var(--clr-primary)" : "var(--clr-stroke-dark)",
              transition: "background 0.2s ease",
            }}
          />
        ))}
      </div>
    </div>
  );
}

const ENVELOPE_LABELS: Record<string, string> = {
  AV: "Assurance-vie",
  PER: "PER",
  CTO: "Compte-titres",
  PEA: "PEA",
  PEA_PME: "PEA-PME",
  DIRECT_OWNERSHIP: "Détention directe",
};

function formatEuros(amount: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 0 }).format(amount);
}

export default function ProductSummaryStep({
  journeyId,
  stepId,
  investorId,
  investorType,
  productName,
  riskTolerance,
  basket,
  actionUrl,
  onComplete,
}: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);
    try {
      await callAction({ type: "complete", journeyId, stepId });
      onComplete();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSubmitting(false);
    }
  }

  const amount = basket?.lines?.[0]?.requestedAmount ?? null;
  const envelopeType = basket?.envelopeTarget?.envelopeType ?? null;

  const summaryItems: { label: string; value: string; custom?: React.ReactNode }[] = [
    { label: "Produit", value: productName ?? "—" },
    ...(riskTolerance ? [{ label: "Profil de risque", value: "", custom: <RiskGauge level={riskTolerance} /> }] : []),
    { label: "Enveloppe", value: envelopeType ? (ENVELOPE_LABELS[envelopeType] ?? envelopeType) : "Non sélectionnée" },
    { label: "Montant engagé", value: amount ? formatEuros(amount / 100) : "Non défini" },
  ];

  return (
    <div className="step-panel">
      <div className="step-panel__header">
        <div className="step-panel__icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--clr-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
        </div>
        <div>
          <h2 className="step-panel__title">Récapitulatif de votre souscription</h2>
          <p className="step-panel__desc">Vérifiez les informations avant de confirmer.</p>
        </div>
      </div>

      {error && <div className="form-error" style={{ marginBottom: "var(--space-md)" }}>{error}</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 0, marginBottom: "var(--space-lg)", border: "1px solid var(--clr-mauve)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
        {summaryItems.map((item, i) => (
          <div key={item.label} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "var(--space-md)",
            borderBottom: i < summaryItems.length - 1 ? "1px solid var(--clr-mauve)" : undefined,
            background: i % 2 === 0 ? "var(--clr-off-white)" : "white",
          }}>
            <span style={{ fontSize: 14, color: "var(--clr-cashmere)", fontWeight: 500 }}>{item.label}</span>
            {item.custom ?? <span style={{ fontSize: 15, color: "var(--clr-obsidian)", fontWeight: 600 }}>{item.value}</span>}
          </div>
        ))}
      </div>

      <button
        className="btn-primary"
        style={{ width: "100%", justifyContent: "center", opacity: !submitting ? 1 : 0.5 }}
        disabled={submitting}
        onClick={handleConfirm}
      >
        {submitting ? "Confirmation..." : "Confirmer ma souscription"}
      </button>
    </div>
  );
}
