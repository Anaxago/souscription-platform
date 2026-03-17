import { useState } from "react";

interface Share {
  id: string;
  name: string;
  minimumInvestmentInCents: number;
  minimumInvestmentCurrency: string;
}

interface Props {
  journeyId: string;
  stepId: string;
  minimumInvestmentInCents: number | null;
  minimumInvestmentCurrency: string;
  productName: string;
  financialInstrumentId: string | null;
  shares: Share[];
  existingLines: BasketLine[];
  actionUrl: string;
  onComplete: () => void;
}

interface BasketLine {
  lineType: string;
  financialInstrumentId: string | null;
  requestedAmount: number | null;
  requestedSecuritiesCount: number | null;
}

function formatCurrency(cents: number, currency: string): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  }).format(cents / 100);
}

const PRESET_AMOUNTS = [500000, 1000000, 2500000, 5000000]; // 5k, 10k, 25k, 50k

export default function ProductSelectionStep({
  journeyId,
  stepId,
  minimumInvestmentInCents,
  minimumInvestmentCurrency,
  productName,
  financialInstrumentId,
  shares,
  existingLines,
  actionUrl,
  onComplete,
}: Props) {
  // Auto-select the first (or only) share
  const defaultShare = shares[0] ?? null;
  const minCents = minimumInvestmentInCents ?? 0;
  const currency = minimumInvestmentCurrency || "EUR";

  // Init from existing basket line
  const existingAmount = existingLines[0]?.requestedAmount ?? null;
  const [amountEuros, setAmountEuros] = useState<string>(
    existingAmount ? String(existingAmount / 100) : "",
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountCents = Math.round((parseFloat(amountEuros) || 0) * 100);
  const isValid = amountCents >= minCents && amountCents > 0;

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

  async function handleSubmit() {
    if (!isValid) return;
    setSubmitting(true);
    setError(null);
    try {
      // Add basket line
      await callAction({
        type: "add-basket-line",
        journeyId,
        lineType: financialInstrumentId ? "FINANCIAL_INSTRUMENT" : "SUPPORT",
        financialInstrumentId,
        shareId: defaultShare?.id ?? null,
        requestedAmount: amountCents,
      });

      // Complete step
      await callAction({ type: "complete", journeyId, stepId });
      onComplete();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="step-panel">
      <div className="step-panel__header">
        <div className="step-panel__icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--clr-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="1" x2="12" y2="23" />
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
        </div>
        <div>
          <h2 className="step-panel__title">Montant d'investissement</h2>
          <p className="step-panel__desc">
            Choisissez le montant que vous souhaitez investir dans {productName}.
          </p>
        </div>
      </div>

      {error && <div className="form-error" style={{ marginBottom: "var(--space-md)" }}>{error}</div>}

      {/* Preset amounts */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "var(--space-xs)", marginBottom: "var(--space-md)" }}>
        {PRESET_AMOUNTS.filter((a) => a >= minCents).map((cents) => (
          <button
            key={cents}
            className="amount-preset"
            style={{
              borderColor: amountCents === cents ? "var(--clr-primary)" : undefined,
              background: amountCents === cents ? "var(--clr-primary-light)" : undefined,
              color: amountCents === cents ? "var(--clr-primary)" : undefined,
            }}
            onClick={() => setAmountEuros(String(cents / 100))}
          >
            {formatCurrency(cents, currency)}
          </button>
        ))}
      </div>

      {/* Custom amount input */}
      <div style={{ marginBottom: "var(--space-md)" }}>
        <label className="form-label">Montant personnalisé</label>
        <div style={{ position: "relative" }}>
          <input
            type="number"
            className="form-input"
            placeholder={minCents > 0 ? `Min. ${minCents / 100}` : "Montant"}
            value={amountEuros}
            onChange={(e) => setAmountEuros(e.target.value)}
            min={minCents / 100}
            step="100"
            style={{ paddingRight: 40 }}
          />
          <span
            style={{
              position: "absolute",
              right: 16,
              top: "50%",
              transform: "translateY(-50%)",
              fontFamily: "var(--font-display)",
              fontSize: 16,
              fontWeight: 600,
              color: "var(--clr-cashmere)",
            }}
          >
            €
          </span>
        </div>
        {minCents > 0 && (
          <p style={{ fontSize: 12, color: "var(--clr-cashmere)", marginTop: 4 }}>
            Investissement minimum : {formatCurrency(minCents, currency)}
          </p>
        )}
        {amountCents > 0 && amountCents < minCents && (
          <p style={{ fontSize: 12, color: "#c0392b", marginTop: 4 }}>
            Le montant doit être d'au moins {formatCurrency(minCents, currency)}
          </p>
        )}
      </div>

      {/* Summary */}
      {isValid && (
        <div className="confirm-summary" style={{ marginBottom: "var(--space-md)" }}>
          <div className="confirm-summary__row">
            <span className="confirm-summary__label">Produit</span>
            <span className="confirm-summary__value">{productName}</span>
          </div>
          <div className="confirm-summary__row">
            <span className="confirm-summary__label">Montant</span>
            <span className="confirm-summary__value" style={{ fontSize: 18 }}>
              {formatCurrency(amountCents, currency)}
            </span>
          </div>
        </div>
      )}

      <button
        className="btn-primary"
        style={{
          width: "100%",
          justifyContent: "center",
          opacity: isValid && !submitting ? 1 : 0.5,
        }}
        disabled={!isValid || submitting}
        onClick={handleSubmit}
      >
        {submitting ? "Enregistrement..." : "Confirmer le montant"}
      </button>
    </div>
  );
}
