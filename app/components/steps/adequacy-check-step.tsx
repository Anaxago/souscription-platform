import { useState } from "react";

interface Props {
  journeyId: string;
  stepId: string;
  investorType: string;
  productName: string | null;
  envelopeType: string | null;
  amount: number | null;
  state: AdequacyState | null;
  actionUrl: string;
  onComplete: () => void;
}

interface AdequacyState {
  lastCheckId: string | null;
  result: "ADEQUATE" | "NEUTRAL" | "INADEQUATE" | "INCOMPLETE_PROFILE" | "OVERRIDDEN" | null;
  overridden: boolean;
}

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
  result: string;
  resultLabel: string;
  resultDesc: string;
  date: string;
}) {
  // Generate HTML report and open print dialog (native PDF save)
  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Rapport d'adéquation — ${data.productName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #0d2e2b; padding: 48px; line-height: 1.6; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; padding-bottom: 24px; border-bottom: 2px solid #1a5d56; }
    .logo { font-size: 24px; font-weight: 700; color: #1a5d56; letter-spacing: -0.02em; }
    .date { font-size: 12px; color: #3d6b66; }
    h1 { font-size: 22px; font-weight: 600; color: #0d2e2b; margin-bottom: 8px; }
    .subtitle { font-size: 14px; color: #3d6b66; margin-bottom: 32px; }
    .section { margin-bottom: 28px; }
    .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #3d6b66; margin-bottom: 12px; }
    .table { width: 100%; border-collapse: collapse; }
    .table td { padding: 12px 16px; border-bottom: 1px solid #e0f0ee; font-size: 14px; }
    .table td:first-child { color: #3d6b66; width: 40%; }
    .table td:last-child { font-weight: 600; }
    .result-box { padding: 20px; border-radius: 8px; margin-bottom: 24px; }
    .result-box.adequate { background: #e0f0ee; border: 1px solid #1a5d56; }
    .result-box.neutral { background: #fef8ec; border: 1px solid #e6a032; }
    .result-box.inadequate, .result-box.overridden { background: #fdf2f2; border: 1px solid #c0392b; }
    .result-label { font-size: 16px; font-weight: 700; margin-bottom: 4px; }
    .result-desc { font-size: 13px; color: #3d6b66; }
    .disclaimer { font-size: 11px; color: #7ab5af; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e0f0ee; line-height: 1.5; }
    @media print { body { padding: 24px; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo">Stanza</div>
    </div>
    <div class="date">${data.date}</div>
  </div>

  <h1>Rapport d'adéquation</h1>
  <p class="subtitle">Évaluation réglementaire de l'adéquation du produit au profil investisseur</p>

  <div class="section">
    <div class="section-title">Détails de la souscription</div>
    <table class="table">
      <tr><td>Produit</td><td>${data.productName}</td></tr>
      <tr><td>Enveloppe</td><td>${data.envelopeType}</td></tr>
      <tr><td>Montant engagé</td><td>${data.amount}</td></tr>
      <tr><td>Type d'investisseur</td><td>${data.investorType === "NATURAL" ? "Personne physique" : "Personne morale"}</td></tr>
    </table>
  </div>

  <div class="section">
    <div class="section-title">Résultat du test d'adéquation</div>
    <div class="result-box ${data.result.toLowerCase()}">
      <div class="result-label" style="color: ${data.result === "ADEQUATE" ? "#1a5d56" : data.result === "NEUTRAL" ? "#e6a032" : "#c0392b"}">${data.resultLabel}</div>
      <div class="result-desc">${data.resultDesc}</div>
    </div>
  </div>

  <div class="disclaimer">
    <strong>Avertissement</strong> — Ce rapport est généré automatiquement dans le cadre de l'obligation réglementaire de test d'adéquation (MiFID II / DDA).
    Il ne constitue pas un conseil en investissement. Les performances passées ne préjugent pas des performances futures.
    L'investissement dans des produits financiers comporte des risques, y compris la perte partielle ou totale du capital investi.
    <br><br>
    Document généré le ${data.date} par la plateforme Stanza.
  </div>
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank");
  if (win) {
    win.onload = () => {
      setTimeout(() => win.print(), 300);
    };
  }
}

export default function AdequacyCheckStep({
  journeyId,
  stepId,
  investorType,
  productName,
  envelopeType,
  amount,
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
      const updatedStep = (journey as { steps: { id: string; state: AdequacyState }[] }).steps?.find(
        (s: { id: string }) => s.id === stepId,
      );
      if (updatedStep?.state) {
        setResult(updatedStep.state.result);
        setLastCheckId(updatedStep.state.lastCheckId);
      }
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

  function handleDownloadReport() {
    const resultInfo = result ? RESULT_CONFIG[result] : null;
    generatePdfReport({
      productName: productName ?? "—",
      envelopeType: envelopeType ? (ENVELOPE_LABELS[envelopeType] ?? envelopeType) : "—",
      amount: amount ? formatEuros(amount) : "—",
      investorType,
      result: result ?? "UNKNOWN",
      resultLabel: resultInfo?.label ?? "—",
      resultDesc: resultInfo?.desc ?? "—",
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
        <button className="btn-primary" style={{ width: "100%", justifyContent: "center" }} disabled={overriding} onClick={handleOverride}>
          {overriding ? "..." : "J'accepte les risques et je souhaite continuer"}
        </button>
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
