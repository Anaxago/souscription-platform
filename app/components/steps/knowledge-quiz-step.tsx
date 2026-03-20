import { useState, useEffect } from "react";

interface Props {
  journeyId: string;
  stepId: string;
  investorId: string;
  investorType: string;
  personKernelId: string;
  financialInstrumentId: string | null;
  actionUrl: string;
  onComplete: () => void;
}

interface Choice {
  id?: string;
  choiceId?: string;
  choiceKey?: string;
  label: string;
  isCorrect?: boolean;
}

interface Question {
  id: string;
  position: number;
  wording: string;
  type: "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "TRUE_FALSE";
  choices: Choice[];
  correctFeedback?: string | null;
  incorrectFeedback?: string | null;
}

interface QuizTemplate {
  id: string;
  questions: Question[];
  approvedThreshold: number;
  warningThreshold: number;
}

interface QuizResult {
  score: number;
  outcome: "APPROVED" | "WARNING" | "BLOCKED";
  totalQuestions: number;
}

function getChoiceKey(c: Choice): string {
  return c.choiceKey ?? c.choiceId ?? c.id ?? "";
}

export default function KnowledgeQuizStep({
  journeyId,
  stepId,
  investorId,
  investorType,
  personKernelId,
  financialInstrumentId,
  actionUrl,
  onComplete,
}: Props) {
  const [quiz, setQuiz] = useState<QuizTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<QuizResult | null>(null);

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

  useEffect(() => {
    if (!financialInstrumentId) {
      setLoading(false);
      return;
    }
    async function fetchQuiz() {
      try {
        const data = await callAction({
          type: "fetch-knowledge-quiz",
          financialInstrumentId,
        });
        setQuiz(data as QuizTemplate);
      } catch {
        setError("Impossible de charger le quiz.");
      } finally {
        setLoading(false);
      }
    }
    fetchQuiz();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [financialInstrumentId]);

  function handleSelect(questionId: string, choiceId: string, type: string) {
    setAnswers((prev) => {
      if (type === "MULTIPLE_CHOICE") {
        const current = prev[questionId] ?? [];
        const updated = current.includes(choiceId)
          ? current.filter((c) => c !== choiceId)
          : [...current, choiceId];
        return { ...prev, [questionId]: updated };
      }
      return { ...prev, [questionId]: [choiceId] };
    });
  }

  async function handleSubmit() {
    if (!quiz) return;
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const apiInvestorType = investorType === "LEGAL" ? "LEGAL_ENTITY" : "INDIVIDUAL";
      const evalResult = await callAction({
        type: "evaluate-knowledge-quiz",
        journeyId,
        stepId,
        investorType: apiInvestorType,
        performedBy: personKernelId,
        answers: quiz.questions.map((q) => ({
          questionId: q.id,
          selectedChoiceKeys: answers[q.id] ?? [],
        })),
      });

      const journeyData = evalResult as { steps?: { id: string; state?: { outcome?: string; score?: number } }[] };
      const thisStep = journeyData.steps?.find((s) => s.id === stepId);
      const outcome = (thisStep?.state?.outcome ?? "") as QuizResult["outcome"];
      const score = thisStep?.state?.score ?? 0;
      const totalQuestions = quiz.questions.length;

      setResult({ score, outcome, totalQuestions });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur inconnue";
      setError(msg);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setSubmitting(false);
    }
  }

  function handleRetry() {
    setAnswers({});
    setResult(null);
    setError(null);
  }

  // ── Loading ──
  if (loading) {
    return (
      <div className="step-panel">
        <p style={{ textAlign: "center", color: "var(--clr-cashmere)", padding: "var(--space-lg)" }}>
          Chargement du quiz...
        </p>
      </div>
    );
  }

  // ── No quiz available ──
  if (!quiz || quiz.questions.length === 0) {
    return (
      <div className="step-panel">
        <div className="step-panel__header">
          <div className="step-panel__icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--clr-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div>
            <h2 className="step-panel__title">Quiz de connaissances</h2>
            <p className="step-panel__desc">Aucun quiz disponible pour ce produit.</p>
          </div>
        </div>
        <button className="btn-primary" style={{ width: "100%", justifyContent: "center", marginTop: "var(--space-lg)" }} onClick={async () => {
          try {
            await callAction({ type: "complete", journeyId, stepId });
            onComplete();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Erreur");
          }
        }}>
          Passer cette étape
        </button>
      </div>
    );
  }

  const questions = [...quiz.questions].sort((a, b) => a.position - b.position);
  const allAnswered = questions.every((q) => (answers[q.id]?.length ?? 0) > 0);
  const correctCount = result ? Math.round((result.score / 100) * result.totalQuestions) : 0;
  const missedCount = result ? result.totalQuestions - correctCount : 0;

  function renderQuestionFeedback() {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)", marginBottom: "var(--space-lg)", textAlign: "left" }}>
        {questions.map((q, i) => {
          const selectedKeys = answers[q.id] ?? [];
          const correctChoice = q.choices.find((c) => c.isCorrect);
          const correctKey = correctChoice ? getChoiceKey(correctChoice) : "";
          const userCorrect = selectedKeys.includes(correctKey);
          const selectedLabel = q.choices.find((c) => selectedKeys.includes(getChoiceKey(c)))?.label ?? "—";
          const correctLabel = correctChoice?.label ?? "—";

          return (
            <div key={q.id} style={{
              padding: "var(--space-sm) var(--space-md)",
              borderRadius: "var(--radius-md)",
              border: `1.5px solid ${userCorrect ? "var(--clr-primary)" : "var(--clr-error)"}`,
              background: userCorrect ? "var(--clr-success-light)" : "var(--clr-error-light)",
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 4 }}>
                {userCorrect ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--clr-primary)" strokeWidth="2.5" style={{ flexShrink: 0, marginTop: 2 }}><polyline points="20 6 9 17 4 12" /></svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--clr-error)" strokeWidth="2.5" style={{ flexShrink: 0, marginTop: 2 }}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                )}
                <p style={{ fontSize: 14, fontWeight: 500, color: "var(--clr-obsidian)", margin: 0 }}>
                  {i + 1}. {q.wording}
                </p>
              </div>
              <div style={{ marginLeft: 26, fontSize: 13 }}>
                <p style={{ margin: "2px 0", color: userCorrect ? "var(--clr-primary)" : "var(--clr-error)" }}>
                  Votre réponse : {selectedLabel}
                </p>
                {!userCorrect && (
                  <p style={{ margin: "2px 0", color: "var(--clr-primary)" }}>
                    Bonne réponse : {correctLabel}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ── Result: APPROVED ──
  if (result?.outcome === "APPROVED") {
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
            Quiz validé
          </h2>
          <p style={{ fontSize: 16, color: "var(--clr-primary)", fontWeight: 600, marginBottom: "var(--space-sm)" }}>
            {Math.round(result.score)}% de bonnes réponses
          </p>
          <p style={{ fontSize: 14, color: "var(--clr-cashmere)", maxWidth: 400, margin: "0 auto var(--space-lg)" }}>
            Vous avez démontré une bonne compréhension du produit. Vous pouvez poursuivre votre souscription.
          </p>
          {renderQuestionFeedback()}
          <button className="btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={onComplete}>
            Continuer
          </button>
        </div>
      </div>
    );
  }

  // ── Result: WARNING ──
  if (result?.outcome === "WARNING") {
    return (
      <div className="step-panel">
        <div style={{ textAlign: "center", padding: "var(--space-lg) 0" }}>
          <div style={{
            width: 72, height: 72, borderRadius: "50%",
            background: "var(--clr-warning-light)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto var(--space-md)",
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--clr-warning)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 400, color: "var(--clr-obsidian)", marginBottom: "var(--space-xs)" }}>
            Quiz validé avec réserves
          </h2>
          <p style={{ fontSize: 16, color: "var(--clr-warning)", fontWeight: 600, marginBottom: "var(--space-sm)" }}>
            {Math.round(result.score)}% de bonnes réponses
          </p>
          <p style={{ fontSize: 14, color: "var(--clr-cashmere)", maxWidth: 420, margin: "0 auto var(--space-xs)" }}>
            {missedCount > 0
              ? `Il vous manquait ${missedCount} bonne${missedCount > 1 ? "s" : ""} réponse${missedCount > 1 ? "s" : ""} pour un score optimal.`
              : "Votre score est suffisant mais mérite attention."}
          </p>
          <p style={{ fontSize: 14, color: "var(--clr-cashmere)", maxWidth: 420, margin: "0 auto var(--space-lg)" }}>
            Nous vous recommandons de consulter la documentation du produit avant de finaliser votre investissement.
          </p>
          {renderQuestionFeedback()}
          <button className="btn-primary" style={{ width: "100%", justifyContent: "center", marginBottom: "var(--space-sm)" }} onClick={onComplete}>
            Continuer malgré l'avertissement
          </button>
          <button
            style={{ width: "100%", padding: "var(--space-sm)", background: "none", border: "1.5px solid var(--clr-primary)", borderRadius: "var(--radius-md)", color: "var(--clr-primary)", cursor: "pointer", fontSize: 14, fontWeight: 500 }}
            onClick={handleRetry}
          >
            Recommencer le quiz
          </button>
        </div>
      </div>
    );
  }

  // ── Result: BLOCKED ──
  if (result?.outcome === "BLOCKED") {
    return (
      <div className="step-panel">
        <div style={{ textAlign: "center", padding: "var(--space-lg) 0" }}>
          <div style={{
            width: 72, height: 72, borderRadius: "50%",
            background: "var(--clr-error-light)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto var(--space-md)",
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--clr-error)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 400, color: "var(--clr-obsidian)", marginBottom: "var(--space-xs)" }}>
            Encore un petit effort
          </h2>
          <p style={{ fontSize: 16, color: "var(--clr-error)", fontWeight: 600, marginBottom: "var(--space-sm)" }}>
            {Math.round(result.score)}% de bonnes réponses
          </p>
          <p style={{ fontSize: 14, color: "var(--clr-cashmere)", maxWidth: 420, margin: "0 auto var(--space-xs)" }}>
            {missedCount > 0
              ? `Il vous manquait ${missedCount} bonne${missedCount > 1 ? "s" : ""} réponse${missedCount > 1 ? "s" : ""} pour valider cette étape.`
              : "Votre score est en dessous du seuil requis."}
          </p>
          <p style={{ fontSize: 14, color: "var(--clr-cashmere)", maxWidth: 420, margin: "0 auto var(--space-lg)" }}>
            Prenez le temps de réviser les notions clés avant de réessayer. Vous pouvez consulter la documentation du produit pour vous aider.
          </p>
          {renderQuestionFeedback()}
          <button className="btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={handleRetry}>
            Recommencer le quiz
          </button>
        </div>
      </div>
    );
  }

  // ── Quiz form ──
  return (
    <div className="step-panel">
      <div className="step-panel__header">
        <div className="step-panel__icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--clr-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <div>
          <h2 className="step-panel__title">Quiz de connaissances</h2>
          <p className="step-panel__desc">
            Répondez aux questions suivantes pour valider vos connaissances sur ce produit.
          </p>
        </div>
      </div>

      {error && <div className="form-error" style={{ marginBottom: "var(--space-md)" }}>{error}</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-lg)" }}>
        {questions.map((q, qIndex) => {
          const selected = answers[q.id] ?? [];
          const hasAnswered = selected.length > 0;
          const correctChoice = q.choices.find((c) => c.isCorrect);
          const correctKey = correctChoice ? getChoiceKey(correctChoice) : "";
          const isCorrect = hasAnswered && selected.includes(correctKey);
          const feedbackMsg = hasAnswered
            ? (isCorrect ? q.correctFeedback : q.incorrectFeedback)
            : null;

          return (
            <div key={q.id}>
              <p style={{ fontWeight: 500, fontSize: 15, color: "var(--clr-obsidian)", marginBottom: "var(--space-sm)" }}>
                {qIndex + 1}. {q.wording}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
                {q.choices.map((c) => {
                  const key = getChoiceKey(c);
                  const isSelected = selected.includes(key);
                  const showCorrect = hasAnswered && c.isCorrect;
                  const showWrong = hasAnswered && isSelected && !c.isCorrect;

                  let borderColor: string | undefined;
                  let bg: string | undefined;
                  if (showCorrect) {
                    borderColor = "var(--clr-primary)";
                    bg = "var(--clr-success-light)";
                  } else if (showWrong) {
                    borderColor = "var(--clr-error)";
                    bg = "var(--clr-error-light)";
                  } else if (isSelected) {
                    borderColor = "var(--clr-primary)";
                    bg = "var(--clr-primary-light)";
                  }

                  return (
                    <label key={key} className="choice-card" style={{
                      borderColor,
                      background: bg,
                      pointerEvents: hasAnswered ? "none" : undefined,
                      opacity: hasAnswered && !isSelected && !showCorrect ? 0.5 : 1,
                    }}>
                      <input
                        type={q.type === "MULTIPLE_CHOICE" ? "checkbox" : "radio"}
                        name={`quiz-${q.id}`}
                        checked={isSelected}
                        onChange={() => handleSelect(q.id, key, q.type)}
                        style={{ display: "none" }}
                        disabled={hasAnswered}
                      />
                      <span className="choice-card__radio" style={showCorrect ? { borderColor: "var(--clr-primary)" } : showWrong ? { borderColor: "var(--clr-error)" } : undefined}>
                        {(isSelected || showCorrect) && (
                          <span className="choice-card__radio-dot" style={showWrong ? { background: "var(--clr-error)" } : undefined} />
                        )}
                      </span>
                      <span className="choice-card__label" style={{ flex: 1 }}>{c.label}</span>
                      {showCorrect && (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--clr-primary)" strokeWidth="2.5" style={{ flexShrink: 0 }}><polyline points="20 6 9 17 4 12" /></svg>
                      )}
                      {showWrong && (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--clr-error)" strokeWidth="2.5" style={{ flexShrink: 0 }}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                      )}
                    </label>
                  );
                })}
              </div>
              {hasAnswered && feedbackMsg && (
                <div style={{
                  marginTop: "var(--space-xs)",
                  padding: "var(--space-xs) var(--space-sm)",
                  borderRadius: "var(--radius-sm)",
                  background: isCorrect ? "var(--clr-success-light)" : "var(--clr-error-light)",
                  fontSize: 13,
                  color: isCorrect ? "var(--clr-primary)" : "var(--clr-error)",
                  lineHeight: 1.4,
                }}>
                  {feedbackMsg}
                </div>
              )}
              {hasAnswered && !feedbackMsg && (
                <div style={{
                  marginTop: "var(--space-xs)",
                  fontSize: 13,
                  color: isCorrect ? "var(--clr-primary)" : "var(--clr-error)",
                  fontWeight: 500,
                }}>
                  {isCorrect ? "Bonne réponse !" : `La bonne réponse était : ${correctChoice?.label ?? ""}`}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button
        className="btn-primary"
        style={{ width: "100%", justifyContent: "center", marginTop: "var(--space-lg)", opacity: allAnswered && !submitting ? 1 : 0.5 }}
        disabled={!allAnswered || submitting}
        onClick={handleSubmit}
      >
        {submitting ? "Validation..." : "Valider le quiz"}
      </button>
    </div>
  );
}
