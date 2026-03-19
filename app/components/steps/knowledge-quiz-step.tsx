import { useState, useEffect } from "react";

interface Props {
  journeyId: string;
  stepId: string;
  financialInstrumentId: string | null;
  actionUrl: string;
  onComplete: () => void;
}

interface Choice {
  id: string;
  choiceKey: string;
  label: string;
}

interface Question {
  id: string;
  position: number;
  wording: string;
  type: string;
  choices: Choice[];
}

interface QuizTemplate {
  id: string;
  questions: Question[];
  approvedThreshold: number;
  warningThreshold: number;
}

export default function KnowledgeQuizStep({
  journeyId,
  stepId,
  financialInstrumentId,
  actionUrl,
  onComplete,
}: Props) {
  const [quiz, setQuiz] = useState<QuizTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<string, string>>({});
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

  useEffect(() => {
    if (!financialInstrumentId) {
      setLoading(false);
      return;
    }
    async function fetchQuiz() {
      try {
        const result = await callAction({
          type: "fetch-knowledge-quiz",
          financialInstrumentId,
        });
        setQuiz(result as QuizTemplate);
      } catch {
        setError("Impossible de charger le quiz.");
      } finally {
        setLoading(false);
      }
    }
    fetchQuiz();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [financialInstrumentId]);

  async function handleSubmit() {
    if (!quiz) return;
    setSubmitting(true);
    setError(null);
    try {
      await callAction({
        type: "submit-knowledge-quiz",
        journeyId,
        stepId,
        quizId: quiz.id,
        answers: quiz.questions.map((q) => ({
          questionId: q.id,
          choiceId: answers[q.id],
        })),
      });
      onComplete();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSubmitting(false);
    }
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
  const allAnswered = questions.every((q) => answers[q.id]);

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
        {questions.map((q, qIndex) => (
          <div key={q.id}>
            <p style={{ fontWeight: 500, fontSize: 15, color: "var(--clr-obsidian)", marginBottom: "var(--space-sm)" }}>
              {qIndex + 1}. {q.wording}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
              {q.choices.map((c) => (
                <label key={c.id} className="choice-card" style={{
                  borderColor: answers[q.id] === c.id ? "var(--clr-primary)" : undefined,
                  background: answers[q.id] === c.id ? "var(--clr-primary-light)" : undefined,
                }}>
                  <input type="radio" name={`quiz-${q.id}`} checked={answers[q.id] === c.id} onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: c.id }))} style={{ display: "none" }} />
                  <span className="choice-card__radio">
                    {answers[q.id] === c.id && <span className="choice-card__radio-dot" />}
                  </span>
                  <span className="choice-card__label">{c.label}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
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
