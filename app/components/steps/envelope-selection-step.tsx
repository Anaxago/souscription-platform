import { useState } from "react";

interface EligibleEnvelope {
  category: string;
  name: string;
}

interface Props {
  journeyId: string;
  stepId: string;
  eligibleEnvelopes: EligibleEnvelope[];
  actionUrl: string;
  onComplete: () => void;
}

const CATEGORY_LABELS: Record<string, { label: string; desc: string }> = {
  AV: { label: "Assurance-vie", desc: "Contrat d'assurance-vie multisupport" },
  PER: { label: "PER", desc: "Plan d'Épargne Retraite" },
  CTO: { label: "Compte-titres", desc: "Compte-titres ordinaire" },
  PEA: { label: "PEA", desc: "Plan d'Épargne en Actions" },
  PEA_PME: { label: "PEA-PME", desc: "Plan d'Épargne en Actions PME" },
  DIRECT_OWNERSHIP: { label: "Détention directe", desc: "Sans enveloppe fiscale" },
};

const DEFAULT_ENVELOPES: EligibleEnvelope[] = [
  { category: "AV", name: "Assurance-vie" },
  { category: "PER", name: "PER" },
  { category: "CTO", name: "Compte-titres" },
  { category: "PEA", name: "PEA" },
];

const TARGET_TYPES = [
  { value: "TO_CREATE", label: "Ouvrir un nouveau contrat" },
  { value: "EXISTING", label: "Utiliser un contrat existant" },
];

export default function EnvelopeSelectionStep({
  journeyId,
  stepId,
  eligibleEnvelopes,
  actionUrl,
  onComplete,
}: Props) {
  const envelopes = eligibleEnvelopes.length > 0 ? eligibleEnvelopes : DEFAULT_ENVELOPES;
  const envelopeOptions = envelopes.map((e) => ({
    value: e.category,
    label: CATEGORY_LABELS[e.category]?.label ?? e.name,
    desc: CATEGORY_LABELS[e.category]?.desc ?? e.name,
  }));

  const [envelopeType, setEnvelopeType] = useState(envelopeOptions[0]?.value ?? "");
  const [targetType, setTargetType] = useState("TO_CREATE");
  const [existingRef, setExistingRef] = useState("");
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
      await callAction({
        type: "set-envelope-target",
        journeyId,
        targetType,
        envelopeType,
        existingEnvelopeRef: targetType === "EXISTING" ? existingRef : undefined,
      });
      await callAction({ type: "complete", journeyId, stepId });
      onComplete();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSubmitting(false);
    }
  }

  const isValid = envelopeType && (targetType === "TO_CREATE" || existingRef.trim().length > 0);

  return (
    <div className="step-panel">
      <div className="step-panel__header">
        <div className="step-panel__icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--clr-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
            <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
          </svg>
        </div>
        <div>
          <h2 className="step-panel__title">Choix de l'enveloppe</h2>
          <p className="step-panel__desc">Sélectionnez le type de contrat pour votre investissement.</p>
        </div>
      </div>

      {error && <div className="form-error" style={{ marginBottom: "var(--space-md)" }}>{error}</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-lg)" }}>
        {/* Envelope type */}
        <div>
          <label className="form-label">Type d'enveloppe</label>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
            {envelopeOptions.map((opt) => (
              <label key={opt.value} className="choice-card" style={{
                borderColor: envelopeType === opt.value ? "var(--clr-primary)" : undefined,
                background: envelopeType === opt.value ? "var(--clr-primary-light)" : undefined,
              }}>
                <input type="radio" name="envelope" checked={envelopeType === opt.value} onChange={() => setEnvelopeType(opt.value)} style={{ display: "none" }} />
                <span className="choice-card__radio">
                  {envelopeType === opt.value && <span className="choice-card__radio-dot" />}
                </span>
                <div style={{ flex: 1 }}>
                  <span className="choice-card__label">{opt.label}</span>
                  <span className="choice-card__desc">{opt.desc}</span>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* New or existing */}
        <div>
          <label className="form-label">Contrat</label>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
            {TARGET_TYPES.map((opt) => (
              <label key={opt.value} className="choice-card" style={{
                borderColor: targetType === opt.value ? "var(--clr-primary)" : undefined,
                background: targetType === opt.value ? "var(--clr-primary-light)" : undefined,
              }}>
                <input type="radio" name="target" checked={targetType === opt.value} onChange={() => setTargetType(opt.value)} style={{ display: "none" }} />
                <span className="choice-card__radio">
                  {targetType === opt.value && <span className="choice-card__radio-dot" />}
                </span>
                <span className="choice-card__label">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Existing contract ref */}
        {targetType === "EXISTING" && (
          <div>
            <label className="form-label" htmlFor="existingRef">Référence du contrat existant</label>
            <input id="existingRef" className="form-input" placeholder="N° de contrat" value={existingRef} onChange={(e) => setExistingRef(e.target.value)} />
          </div>
        )}
      </div>

      <button className="btn-primary" style={{ width: "100%", justifyContent: "center", marginTop: "var(--space-lg)", opacity: isValid && !submitting ? 1 : 0.5 }} disabled={!isValid || submitting} onClick={handleSubmit}>
        {submitting ? "Enregistrement..." : "Valider l'enveloppe"}
      </button>
    </div>
  );
}
