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
}

interface Question {
  id: string;
  position: number;
  wording: string;
  type: "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "TRUE_FALSE";
  choices: Choice[];
}

interface QuizTemplate {
  id: string;
  questions: Question[];
  approvedThreshold: number;
  warningThreshold: number;
}

interface EvaluateResult {
  score: number;
  outcome: "APPROVED" | "WARNING" | "BLOCKED";
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
  const [result, setResult] = useState<EvaluateResult | null>(null);

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
        console.log("Quiz data:", JSON.stringify((data as QuizTemplate).questions[0]?.choices[0]));
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

  function getChoiceKey(c: Choice): string {
    return c.choiceKey ?? c.choiceId ?? c.id ?? "";
  }

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
    console.log("handleSubmit called, answers:", answers, "allAnswered:", allAnswered);
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
      const res = evalResult as EvaluateResult;
      setResult(res);
      if (res.outcome === "APPROVED" || res.outcome === "WARNING") {
        onComplete();
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur inconnue";
      console.error("Knowledge quiz error:", msg, e);
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

  if (loading) {
    return (
      <div className="step-panel">
        <p style={{ textAlign: "center", color: "var(--clr-cashmere)", padding: "var(--space-lg)" }}>
          Chargement du quiz...
        </p>
      </div>
    );
  }

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
          try { await callAction({ type: "complete", journeyId, stepId }); } catch { /* */ }
          onComplete();
        }}>
          Passer cette étape
        </button>
      </div>
    );
  }

  const questions = [...quiz.questions].sort((a, b) => a.position - b.position);
  const allAnswered = questions.every((q) => (answers[q.id]?.length ?? 0) > 0);
  console.log("Quiz state:", { answers, allAnswered, questionIds: questions.map((q) => q.id) });

  // Blocked result — show score and retry
  if (result?.outcome === "BLOCKED") {
    return (
      <div className="step-panel">
        <div className="step-panel__header">
          <div className="step-panel__icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#c0392b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <div>
            <h2 className="step-panel__title">Score insuffisant</h2>
            <p className="step-panel__desc">
              Votre score est de {Math.round(result.score)}%. Le seuil minimum est de {quiz.warningThreshold}%.
            </p>
          </div>
        </div>
        <p style={{ fontSize: 14, color: "var(--clr-cashmere)", marginBottom: "var(--space-lg)" }}>
          Vous pouvez retenter le quiz pour améliorer votre score.
        </p>
        <button className="btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={handleRetry}>
          Recommencer le quiz
        </button>
      </div>
    );
  }

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
          return (
            <div key={q.id}>
              <p style={{ fontWeight: 500, fontSize: 15, color: "var(--clr-obsidian)", marginBottom: "var(--space-sm)" }}>
                {qIndex + 1}. {q.wording}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
                {q.choices.map((c) => {
                  const key = getChoiceKey(c);
                  const isSelected = selected.includes(key);
                  return (
                    <label key={key} className="choice-card" style={{
                      borderColor: isSelected ? "var(--clr-primary)" : undefined,
                      background: isSelected ? "var(--clr-primary-light)" : undefined,
                    }}>
                      <input
                        type={q.type === "MULTIPLE_CHOICE" ? "checkbox" : "radio"}
                        name={`quiz-${q.id}`}
                        checked={isSelected}
                        onChange={() => handleSelect(q.id, key, q.type)}
                        style={{ display: "none" }}
                      />
                      <span className="choice-card__radio">
                        {isSelected && <span className="choice-card__radio-dot" />}
                      </span>
                      <span className="choice-card__label">{c.label}</span>
                    </label>
                  );
                })}
              </div>
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
