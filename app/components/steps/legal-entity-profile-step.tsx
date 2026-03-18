import { useState } from "react";

interface Props {
  journeyId: string;
  stepId: string;
  investorId: string;
  actionUrl: string;
  onComplete: () => void;
}

interface SourceOfFunds {
  origin: string;
  declaredAmountCents?: number;
  declaredAmountCurrency?: string;
}

const RISK_TOLERANCES = [
  { value: "CONSERVATIVE", label: "Conservateur", desc: "Préserver le capital" },
  { value: "MODERATE", label: "Modéré", desc: "Croissance limitée" },
  { value: "BALANCED", label: "Équilibré", desc: "Croissance et risque modérés" },
  { value: "DYNAMIC", label: "Dynamique", desc: "Rendement élevé, risque élevé" },
  { value: "AGGRESSIVE", label: "Agressif", desc: "Rendement maximum" },
];

const HORIZONS = [
  { value: "SHORT", label: "Court terme", desc: "Moins de 3 ans" },
  { value: "MEDIUM", label: "Moyen terme", desc: "3 à 7 ans" },
  { value: "LONG", label: "Long terme", desc: "Plus de 7 ans" },
];

const KNOWLEDGE_LEVELS = [
  { value: "NOVICE", label: "Novice", desc: "Peu ou pas d'expérience" },
  { value: "INTERMEDIATE", label: "Intermédiaire", desc: "Quelques investissements" },
  { value: "EXPERIENCED", label: "Expérimenté", desc: "Investisseur régulier" },
];

const FUND_ORIGINS = [
  { value: "REVENUE", label: "Chiffre d'affaires" },
  { value: "CAPITAL", label: "Apport en capital" },
  { value: "LOAN", label: "Emprunt" },
  { value: "ASSET_SALE", label: "Cession d'actifs" },
  { value: "OTHER", label: "Autre" },
];

const sectionTitle = { fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 600 as const, color: "var(--clr-obsidian)", marginBottom: "var(--space-md)" };

export default function LegalEntityProfileStep({
  journeyId,
  stepId,
  investorId,
  actionUrl,
  onComplete,
}: Props) {
  const [riskTolerance, setRiskTolerance] = useState("");
  const [horizon, setHorizon] = useState("");
  const [knowledgeLevel, setKnowledgeLevel] = useState("");
  const [sources, setSources] = useState<SourceOfFunds[]>([]);
  const [newOrigin, setNewOrigin] = useState("");
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

  function addSource() {
    if (!newOrigin || sources.some((s) => s.origin === newOrigin)) return;
    setSources((prev) => [...prev, { origin: newOrigin }]);
    setNewOrigin("");
  }

  function removeSource(origin: string) {
    setSources((prev) => prev.filter((s) => s.origin !== origin));
  }

  async function handleSubmit() {
    if (!riskTolerance || !horizon || !knowledgeLevel) {
      setError("Veuillez compléter le profil d'investissement.");
      return;
    }
    if (sources.length === 0) {
      setError("Veuillez déclarer au moins une source de fonds.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      // Update profile
      await callAction({
        type: "update-le-investor-profile",
        investorId,
        riskTolerance,
        horizon,
        knowledgeLevel,
      });

      // Declare sources of funds
      for (const source of sources) {
        await callAction({
          type: "declare-source-of-funds",
          investorId,
          origin: source.origin,
          ...(source.declaredAmountCents ? { declaredAmountCents: source.declaredAmountCents, declaredAmountCurrency: source.declaredAmountCurrency ?? "EUR" } : {}),
        });
      }

      // Complete step
      await callAction({ type: "complete", journeyId, stepId });
      onComplete();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors de la validation");
    } finally {
      setSubmitting(false);
    }
  }

  const isValid = riskTolerance && horizon && knowledgeLevel && sources.length > 0;
  const availableOrigins = FUND_ORIGINS.filter((o) => !sources.some((s) => s.origin === o.value));

  return (
    <div className="step-panel">
      <div className="step-panel__header">
        <div className="step-panel__icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--clr-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </div>
        <div>
          <h2 className="step-panel__title">Profil investisseur</h2>
          <p className="step-panel__desc">
            Renseignez le profil d'investissement et les sources de fonds de la société.
          </p>
        </div>
      </div>

      {error && <div className="form-error" style={{ marginBottom: "var(--space-md)" }}>{error}</div>}

      {/* ── Risk Tolerance ── */}
      <div style={{ marginBottom: "var(--space-lg)" }}>
        <h3 style={sectionTitle}>Tolérance au risque *</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
          {RISK_TOLERANCES.map((opt) => (
            <label key={opt.value} className="choice-card" style={{
              borderColor: riskTolerance === opt.value ? "var(--clr-primary)" : undefined,
              background: riskTolerance === opt.value ? "var(--clr-primary-light)" : undefined,
            }}>
              <input type="radio" name="riskTolerance" checked={riskTolerance === opt.value} onChange={() => setRiskTolerance(opt.value)} style={{ display: "none" }} />
              <span className="choice-card__radio">
                {riskTolerance === opt.value && <span className="choice-card__radio-dot" />}
              </span>
              <div style={{ flex: 1 }}>
                <span className="choice-card__label">{opt.label}</span>
                <span className="choice-card__desc">{opt.desc}</span>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* ── Horizon ── */}
      <div style={{ marginBottom: "var(--space-lg)" }}>
        <h3 style={sectionTitle}>Horizon d'investissement *</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
          {HORIZONS.map((opt) => (
            <label key={opt.value} className="choice-card" style={{
              borderColor: horizon === opt.value ? "var(--clr-primary)" : undefined,
              background: horizon === opt.value ? "var(--clr-primary-light)" : undefined,
            }}>
              <input type="radio" name="horizon" checked={horizon === opt.value} onChange={() => setHorizon(opt.value)} style={{ display: "none" }} />
              <span className="choice-card__radio">
                {horizon === opt.value && <span className="choice-card__radio-dot" />}
              </span>
              <div style={{ flex: 1 }}>
                <span className="choice-card__label">{opt.label}</span>
                <span className="choice-card__desc">{opt.desc}</span>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* ── Knowledge Level ── */}
      <div style={{ marginBottom: "var(--space-lg)" }}>
        <h3 style={sectionTitle}>Niveau de connaissance *</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
          {KNOWLEDGE_LEVELS.map((opt) => (
            <label key={opt.value} className="choice-card" style={{
              borderColor: knowledgeLevel === opt.value ? "var(--clr-primary)" : undefined,
              background: knowledgeLevel === opt.value ? "var(--clr-primary-light)" : undefined,
            }}>
              <input type="radio" name="knowledgeLevel" checked={knowledgeLevel === opt.value} onChange={() => setKnowledgeLevel(opt.value)} style={{ display: "none" }} />
              <span className="choice-card__radio">
                {knowledgeLevel === opt.value && <span className="choice-card__radio-dot" />}
              </span>
              <div style={{ flex: 1 }}>
                <span className="choice-card__label">{opt.label}</span>
                <span className="choice-card__desc">{opt.desc}</span>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* ── Sources of Funds ── */}
      <div style={{ marginBottom: "var(--space-lg)" }}>
        <h3 style={sectionTitle}>Sources de fonds *</h3>

        {sources.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)", marginBottom: "var(--space-sm)" }}>
            {sources.map((s) => {
              const label = FUND_ORIGINS.find((o) => o.value === s.origin)?.label ?? s.origin;
              return (
                <div key={s.origin} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "var(--space-sm) var(--space-md)",
                  background: "var(--clr-primary-light)",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--clr-primary)",
                }}>
                  <span style={{ fontSize: 14, fontWeight: 500, color: "var(--clr-obsidian)" }}>{label}</span>
                  <button
                    type="button"
                    onClick={() => removeSource(s.origin)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--clr-cashmere)", padding: 4 }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {availableOrigins.length > 0 && (
          <div style={{ display: "flex", gap: "var(--space-sm)" }}>
            <select className="form-input" value={newOrigin} onChange={(e) => setNewOrigin(e.target.value)} style={{ flex: 1 }}>
              <option value="">Sélectionner une source...</option>
              {availableOrigins.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <button
              type="button"
              className="btn-primary"
              style={{ whiteSpace: "nowrap", opacity: newOrigin ? 1 : 0.5 }}
              disabled={!newOrigin}
              onClick={addSource}
            >
              Ajouter
            </button>
          </div>
        )}

        {sources.length === 0 && (
          <p style={{ fontSize: 13, color: "var(--clr-cashmere)", fontStyle: "italic", marginTop: "var(--space-xs)" }}>
            Au moins une source de fonds est requise.
          </p>
        )}
      </div>

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
        {submitting ? "Enregistrement..." : "Valider le profil"}
      </button>
    </div>
  );
}
