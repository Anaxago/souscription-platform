import { useState } from "react";

interface Props {
  journeyId: string;
  stepId: string;
  investorId: string;
  actionUrl: string;
  onComplete: () => void;
}

const RISK_OPTIONS = [
  { value: "CONSERVATIVE", label: "Conservateur", desc: "Priorité à la préservation du capital" },
  { value: "MODERATE", label: "Modéré", desc: "Équilibre entre sécurité et rendement" },
  { value: "BALANCED", label: "Équilibré", desc: "Rendement régulier avec risque maîtrisé" },
  { value: "DYNAMIC", label: "Dynamique", desc: "Recherche de performance avec risque élevé" },
  { value: "AGGRESSIVE", label: "Offensif", desc: "Performance maximale, forte tolérance au risque" },
];

const HORIZON_OPTIONS = [
  { value: "SHORT", label: "Court terme", desc: "Moins de 3 ans" },
  { value: "MEDIUM", label: "Moyen terme", desc: "3 à 8 ans" },
  { value: "LONG", label: "Long terme", desc: "Plus de 8 ans" },
];

const KNOWLEDGE_OPTIONS = [
  { value: "NOVICE", label: "Débutant", desc: "Peu ou pas d'expérience en investissement" },
  { value: "INTERMEDIATE", label: "Intermédiaire", desc: "Quelques investissements réalisés" },
  { value: "EXPERIENCED", label: "Expérimenté", desc: "Investisseur régulier avec une bonne connaissance des marchés" },
];

const WEALTH_ORIGINS = [
  { value: "SALARY", label: "Revenus d'activité" },
  { value: "SAVINGS", label: "Épargne" },
  { value: "INHERITANCE", label: "Héritage" },
  { value: "REAL_ESTATE_SALE", label: "Vente immobilière" },
  { value: "DONATION", label: "Donation" },
  { value: "OTHER", label: "Autre" },
];

export default function InvestorProfileStep({
  journeyId,
  stepId,
  investorId,
  actionUrl,
  onComplete,
}: Props) {
  const [riskTolerance, setRiskTolerance] = useState<string>("");
  const [horizon, setHorizon] = useState<string>("");
  const [knowledgeLevel, setKnowledgeLevel] = useState<string>("");
  const [wealthOrigins, setWealthOrigins] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"profile" | "wealth" | "confirm">("profile");

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

  async function handleSubmitProfile() {
    if (!riskTolerance || !horizon || !knowledgeLevel) return;
    setSubmitting(true);
    setError(null);
    try {
      await callAction({
        type: "update-investor-profile",
        investorId,
        riskTolerance,
        horizon,
        knowledgeLevel,
      });
      setPhase("wealth");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitWealth() {
    setSubmitting(true);
    setError(null);
    try {
      for (const origin of wealthOrigins) {
        await callAction({
          type: "add-source-of-wealth",
          investorId,
          origin,
        });
      }
      setPhase("confirm");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleComplete() {
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

  function toggleWealth(value: string) {
    setWealthOrigins((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  }

  return (
    <div className="step-panel">
      <div className="step-panel__header">
        <div className="step-panel__icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--clr-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>
        <div>
          <h2 className="step-panel__title">Profil investisseur</h2>
          <p className="step-panel__desc">
            {phase === "profile" && "Évaluation de votre tolérance au risque, horizon et connaissances."}
            {phase === "wealth" && "D'où proviennent vos fonds d'investissement ?"}
            {phase === "confirm" && "Vérifiez vos informations avant de valider."}
          </p>
        </div>
      </div>

      {/* Progress dots */}
      <div style={{ display: "flex", gap: 6, marginBottom: "var(--space-lg)" }}>
        {(["profile", "wealth", "confirm"] as const).map((p, i) => (
          <div
            key={p}
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: phase === p ? "var(--clr-primary)" :
                (["profile", "wealth", "confirm"].indexOf(phase) > i ? "var(--clr-primary)" : "var(--clr-stroke-dark)"),
            }}
          />
        ))}
      </div>

      {error && <div className="form-error" style={{ marginBottom: "var(--space-md)" }}>{error}</div>}

      {/* Phase 1: Profile */}
      {phase === "profile" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-lg)" }}>
          <RadioGroup
            label="Tolérance au risque"
            options={RISK_OPTIONS}
            value={riskTolerance}
            onChange={setRiskTolerance}
          />
          <RadioGroup
            label="Horizon d'investissement"
            options={HORIZON_OPTIONS}
            value={horizon}
            onChange={setHorizon}
          />
          <RadioGroup
            label="Niveau de connaissance"
            options={KNOWLEDGE_OPTIONS}
            value={knowledgeLevel}
            onChange={setKnowledgeLevel}
          />

          <button
            className="btn-primary"
            style={{
              width: "100%",
              justifyContent: "center",
              opacity: riskTolerance && horizon && knowledgeLevel ? 1 : 0.5,
            }}
            disabled={!riskTolerance || !horizon || !knowledgeLevel || submitting}
            onClick={handleSubmitProfile}
          >
            {submitting ? "Enregistrement..." : "Continuer"}
          </button>
        </div>
      )}

      {/* Phase 2: Sources of wealth */}
      {phase === "wealth" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
          <label className="form-label">Origine de vos fonds (sélectionnez au moins une)</label>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
            {WEALTH_ORIGINS.map((opt) => (
              <label
                key={opt.value}
                className="choice-card"
                style={{
                  borderColor: wealthOrigins.includes(opt.value) ? "var(--clr-primary)" : undefined,
                  background: wealthOrigins.includes(opt.value) ? "var(--clr-primary-light)" : undefined,
                }}
              >
                <input
                  type="checkbox"
                  checked={wealthOrigins.includes(opt.value)}
                  onChange={() => toggleWealth(opt.value)}
                  style={{ display: "none" }}
                />
                <span className="choice-card__check">
                  {wealthOrigins.includes(opt.value) && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--clr-primary)" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </span>
                <span className="choice-card__label">{opt.label}</span>
              </label>
            ))}
          </div>

          <button
            className="btn-primary"
            style={{
              width: "100%",
              justifyContent: "center",
              marginTop: "var(--space-sm)",
              opacity: wealthOrigins.length > 0 ? 1 : 0.5,
            }}
            disabled={wealthOrigins.length === 0 || submitting}
            onClick={handleSubmitWealth}
          >
            {submitting ? "Enregistrement..." : "Continuer"}
          </button>
        </div>
      )}

      {/* Phase 3: Confirm */}
      {phase === "confirm" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
          <div className="confirm-summary">
            <div className="confirm-summary__row">
              <span className="confirm-summary__label">Tolérance au risque</span>
              <span className="confirm-summary__value">
                {RISK_OPTIONS.find((o) => o.value === riskTolerance)?.label}
              </span>
            </div>
            <div className="confirm-summary__row">
              <span className="confirm-summary__label">Horizon</span>
              <span className="confirm-summary__value">
                {HORIZON_OPTIONS.find((o) => o.value === horizon)?.label}
              </span>
            </div>
            <div className="confirm-summary__row">
              <span className="confirm-summary__label">Connaissances</span>
              <span className="confirm-summary__value">
                {KNOWLEDGE_OPTIONS.find((o) => o.value === knowledgeLevel)?.label}
              </span>
            </div>
            <div className="confirm-summary__row">
              <span className="confirm-summary__label">Origine des fonds</span>
              <span className="confirm-summary__value">
                {wealthOrigins.map((o) => WEALTH_ORIGINS.find((w) => w.value === o)?.label).join(", ")}
              </span>
            </div>
          </div>

          <button
            className="btn-primary"
            style={{ width: "100%", justifyContent: "center" }}
            disabled={submitting}
            onClick={handleComplete}
          >
            {submitting ? "Validation..." : "Valider mon profil"}
          </button>

          <button
            style={{
              background: "none",
              border: "none",
              fontFamily: "var(--font-display)",
              fontSize: 13,
              fontWeight: 600,
              color: "var(--clr-cashmere)",
              cursor: "pointer",
              textAlign: "center",
            }}
            onClick={() => setPhase("profile")}
          >
            Modifier mes réponses
          </button>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────
   Radio group component
   ────────────────────────────────────────────── */

function RadioGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string; desc: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="form-label">{label}</label>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
        {options.map((opt) => (
          <label
            key={opt.value}
            className="choice-card"
            style={{
              borderColor: value === opt.value ? "var(--clr-primary)" : undefined,
              background: value === opt.value ? "var(--clr-primary-light)" : undefined,
            }}
          >
            <input
              type="radio"
              name={label}
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
              style={{ display: "none" }}
            />
            <span className="choice-card__radio">
              {value === opt.value && <span className="choice-card__radio-dot" />}
            </span>
            <div style={{ flex: 1 }}>
              <span className="choice-card__label">{opt.label}</span>
              <span className="choice-card__desc">{opt.desc}</span>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}
