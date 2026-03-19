import { useState } from "react";

interface Props {
  journeyId: string;
  stepId: string;
  investorId: string;
  investorType: string;
  productName: string | null;
  basket: {
    lines: { lineType: string; requestedAmount: number | null }[];
    envelopeTarget: { envelopeType: string; provider: string | null } | null;
  } | null;
  actionUrl: string;
  onComplete: () => void;
}

const RISK_LABELS: Record<string, string> = {
  CONSERVATIVE: "Conservateur",
  MODERATE: "Modéré",
  BALANCED: "Équilibré",
  DYNAMIC: "Dynamique",
  AGGRESSIVE: "Agressif",
};

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
  basket,
  actionUrl,
  onComplete,
}: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
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
    console.log("[ProductSummary] handleConfirm called", { journeyId, stepId });
    setSubmitting(true);
    setError(null);
    try {
      const result = await callAction({ type: "complete", journeyId, stepId });
      console.log("[ProductSummary] complete succeeded", result);
      setConfirmed(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      console.error("[ProductSummary] complete FAILED", e);
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSubmitting(false);
    }
  }

  const amount = basket?.lines?.[0]?.requestedAmount ?? null;
  const envelopeType = basket?.envelopeTarget?.envelopeType ?? null;

  const summaryItems = [
    { label: "Produit", value: productName ?? "—" },
    { label: "Enveloppe", value: envelopeType ? (ENVELOPE_LABELS[envelopeType] ?? envelopeType) : "Non sélectionnée" },
    { label: "Montant engagé", value: amount ? formatEuros(amount / 100) : "Non défini" },
  ];

  if (confirmed) {
    return (
      <div className="step-panel">
        <div style={{ textAlign: "center", padding: "var(--space-lg) 0" }}>
          <div style={{
            width: 72, height: 72, borderRadius: "50%",
            background: "var(--clr-success-light)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto var(--space-md)",
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--clr-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 400, color: "var(--clr-obsidian)", marginBottom: "var(--space-xs)" }}>
            Souscription confirmée
          </h2>
          <p style={{ fontSize: 15, color: "var(--clr-cashmere)", maxWidth: 420, margin: "0 auto var(--space-lg)" }}>
            Votre souscription a été enregistrée. Vous pouvez poursuivre les étapes restantes.
          </p>
          <button className="btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={onComplete}>
            Continuer
          </button>
        </div>
      </div>
    );
  }

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
            <span style={{ fontSize: 15, color: "var(--clr-obsidian)", fontWeight: 600 }}>{item.value}</span>
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
