import { useState } from "react";

interface Props {
  journeyId: string;
  stepId: string;
  actionUrl: string;
  onComplete: () => void;
}

const DISMEMBERMENT_OPTIONS = [
  { value: "FULL_OWNERSHIP", label: "Pleine propriété", desc: "Vous détenez l'intégralité des droits sur votre investissement." },
  { value: "USUFRUCT", label: "Usufruit", desc: "Vous percevez les revenus de l'investissement pour une durée déterminée." },
  { value: "BARE_OWNERSHIP", label: "Nue-propriété", desc: "Vous détenez la propriété sans percevoir les revenus, avec une décote à l'achat." },
];

export default function DismembermentSelectionStep({
  journeyId,
  stepId,
  actionUrl,
  onComplete,
}: Props) {
  const [selection, setSelection] = useState("FULL_OWNERSHIP");
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

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      // If not full ownership, update basket line with dismemberment type
      if (selection !== "FULL_OWNERSHIP") {
        await callAction({
          type: "update-basket-dismemberment",
          journeyId,
          dismembermentType: selection,
        });
      }
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
            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
          </svg>
        </div>
        <div>
          <h2 className="step-panel__title">Mode de détention</h2>
          <p className="step-panel__desc">Choisissez comment vous souhaitez détenir votre investissement.</p>
        </div>
      </div>

      {error && <div className="form-error" style={{ marginBottom: "var(--space-md)" }}>{error}</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
        {DISMEMBERMENT_OPTIONS.map((opt) => (
          <label key={opt.value} className="choice-card" style={{
            borderColor: selection === opt.value ? "var(--clr-primary)" : undefined,
            background: selection === opt.value ? "var(--clr-primary-light)" : undefined,
          }}>
            <input type="radio" name="dismemberment" checked={selection === opt.value} onChange={() => setSelection(opt.value)} style={{ display: "none" }} />
            <span className="choice-card__radio">
              {selection === opt.value && <span className="choice-card__radio-dot" />}
            </span>
            <div style={{ flex: 1 }}>
              <span className="choice-card__label">{opt.label}</span>
              <span className="choice-card__desc">{opt.desc}</span>
            </div>
          </label>
        ))}
      </div>

      <button className="btn-primary" style={{ width: "100%", justifyContent: "center", marginTop: "var(--space-lg)" }} disabled={submitting} onClick={handleSubmit}>
        {submitting ? "Enregistrement..." : "Valider"}
      </button>
    </div>
  );
}
