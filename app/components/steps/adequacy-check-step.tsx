import { useState } from "react";

interface Props {
  journeyId: string;
  stepId: string;
  investorType: string;
  state: AdequacyState | null;
  actionUrl: string;
  onComplete: () => void;
}

interface AdequacyState {
  lastCheckId: string | null;
  result: "ADEQUATE" | "NEUTRAL" | "INADEQUATE" | "INCOMPLETE_PROFILE" | "OVERRIDDEN" | null;
  overridden: boolean;
}

const RESULT_CONFIG: Record<string, { label: string; desc: string; color: string; icon: "check" | "warning" | "error" }> = {
  ADEQUATE: { label: "Adéquat", desc: "Ce produit est adapté à votre profil investisseur.", color: "var(--clr-primary)", icon: "check" },
  NEUTRAL: { label: "Neutre", desc: "Les informations disponibles ne permettent pas de confirmer l'adéquation.", color: "var(--clr-cashmere)", icon: "warning" },
  INADEQUATE: { label: "Inadéquat", desc: "Ce produit ne correspond pas à votre profil. Vous pouvez continuer en acceptant les risques.", color: "var(--clr-mauve)", icon: "error" },
  INCOMPLETE_PROFILE: { label: "Profil incomplet", desc: "Veuillez compléter votre profil investisseur pour effectuer ce contrôle.", color: "var(--clr-mauve)", icon: "error" },
  OVERRIDDEN: { label: "Dérogation acceptée", desc: "Vous avez accepté de poursuivre malgré l'inadéquation.", color: "var(--clr-cashmere)", icon: "check" },
};

export default function AdequacyCheckStep({
  journeyId,
  stepId,
  investorType,
  state,
  actionUrl,
  onComplete,
}: Props) {
  const [checking, setChecking] = useState(false);
  const [overriding, setOverriding] = useState(false);
  const [result, setResult] = useState<string | null>(state?.result ?? null);
  const [lastCheckId, setLastCheckId] = useState<string | null>(state?.lastCheckId ?? null);
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
      // Read updated state from the journey response
      const updatedStep = (journey as { steps: { id: string; state: AdequacyState }[] }).steps?.find(
        (s: { id: string }) => s.id === stepId,
      );
      if (updatedStep?.state) {
        setResult(updatedStep.state.result);
        setLastCheckId(updatedStep.state.lastCheckId);
      }
      // If adequate, step is auto-completed
      if (updatedStep?.state?.result === "ADEQUATE" || updatedStep?.state?.result === "OVERRIDDEN") {
        onComplete();
      }
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setOverriding(false);
    }
  }

  async function handleContinue() {
    // ADEQUACY_CHECK is event-driven. For NEUTRAL result,
    // just re-fetch the journey to check if the step auto-completed.
    onComplete();
  }

  const resultInfo = result ? RESULT_CONFIG[result] : null;

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

      {/* No result yet — run the check */}
      {!result && (
        <button className="btn-primary" style={{ width: "100%", justifyContent: "center" }} disabled={checking} onClick={handleEvaluate}>
          {checking ? "Analyse en cours..." : "Lancer le test d'adéquation"}
        </button>
      )}

      {/* Result display */}
      {result && resultInfo && (
        <div style={{
          padding: "var(--space-md)",
          borderRadius: "var(--radius-md)",
          border: `1px solid ${resultInfo.color}`,
          background: result === "ADEQUATE" || result === "OVERRIDDEN" ? "var(--clr-primary-light)" : "var(--clr-ecru-bg)",
          marginBottom: "var(--space-md)",
        }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600, color: resultInfo.color, marginBottom: 4 }}>
            {resultInfo.label}
          </div>
          <p style={{ fontSize: 14, color: "var(--clr-cashmere)", margin: 0 }}>
            {resultInfo.desc}
          </p>
        </div>
      )}

      {/* Actions based on result */}
      {result === "NEUTRAL" && (
        <button className="btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={handleContinue}>
          Continuer malgré l'avertissement
        </button>
      )}

      {result === "INADEQUATE" && (
        <button className="btn-primary" style={{ width: "100%", justifyContent: "center" }} disabled={overriding} onClick={handleOverride}>
          {overriding ? "..." : "J'accepte les risques et je souhaite continuer"}
        </button>
      )}

      {result === "INCOMPLETE_PROFILE" && (
        <p style={{ fontSize: 14, color: "var(--clr-mauve)", textAlign: "center" }}>
          Veuillez revenir à l'étape "Profil investisseur" pour compléter vos informations.
        </p>
      )}
    </div>
  );
}
