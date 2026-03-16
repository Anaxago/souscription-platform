import { useState } from "react";

interface Props {
  journeyId: string;
  stepId: string;
  config: StepConfig | null;
  existingAnswers: ProductAnswer[];
  actionUrl: string;
  onComplete: () => void;
}

interface StepConfig {
  questions?: Question[];
}

interface Question {
  questionId: string;
  questionLabel: string;
  choices: Choice[];
}

interface Choice {
  answerId: string;
  label: string;
}

interface ProductAnswer {
  questionId: string;
  questionLabel: string;
  answerId: string;
  snapshotted: boolean;
}

export default function ProductQuestionsStep({
  journeyId,
  stepId,
  config,
  existingAnswers,
  actionUrl,
  onComplete,
}: Props) {
  const questions = config?.questions ?? [];
  const hasQuestions = questions.length > 0;

  // Initialize answers from existing basket answers
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const a of existingAnswers) {
      init[a.questionId] = a.answerId;
    }
    return init;
  });
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
      // Submit answers if there are questions
      if (hasQuestions) {
        const answerPayload = questions.map((q) => ({
          questionId: q.questionId,
          questionLabel: q.questionLabel,
          answerId: answers[q.questionId] ?? "",
          snapshotted: false,
        }));

        await callAction({
          type: "answer-product-questions",
          journeyId,
          answers: answerPayload,
        });
      }

      // Complete step
      await callAction({ type: "complete", journeyId, stepId });
      onComplete();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSubmitting(false);
    }
  }

  const allAnswered = !hasQuestions || questions.every((q) => answers[q.questionId]);

  return (
    <div className="step-panel">
      <div className="step-panel__header">
        <div className="step-panel__icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--clr-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <div>
          <h2 className="step-panel__title">Questions produit</h2>
          <p className="step-panel__desc">
            {hasQuestions
              ? "Répondez aux questions suivantes pour personnaliser votre souscription."
              : "Aucune question spécifique n'est requise pour ce produit."}
          </p>
        </div>
      </div>

      {error && <div className="form-error" style={{ marginBottom: "var(--space-md)" }}>{error}</div>}

      {hasQuestions && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-lg)" }}>
          {questions.map((q, i) => (
            <div key={q.questionId}>
              <label className="form-label">
                {i + 1}. {q.questionLabel}
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
                {q.choices.map((choice) => (
                  <label
                    key={choice.answerId}
                    className="choice-card"
                    style={{
                      borderColor: answers[q.questionId] === choice.answerId ? "var(--clr-primary)" : undefined,
                      background: answers[q.questionId] === choice.answerId ? "var(--clr-primary-light)" : undefined,
                    }}
                  >
                    <input
                      type="radio"
                      name={q.questionId}
                      checked={answers[q.questionId] === choice.answerId}
                      onChange={() => setAnswers((prev) => ({ ...prev, [q.questionId]: choice.answerId }))}
                      style={{ display: "none" }}
                    />
                    <span className="choice-card__radio">
                      {answers[q.questionId] === choice.answerId && <span className="choice-card__radio-dot" />}
                    </span>
                    <span className="choice-card__label">{choice.label}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        className="btn-primary"
        style={{
          width: "100%",
          justifyContent: "center",
          marginTop: "var(--space-lg)",
          opacity: allAnswered && !submitting ? 1 : 0.5,
        }}
        disabled={!allAnswered || submitting}
        onClick={handleSubmit}
      >
        {submitting ? "Validation..." : hasQuestions ? "Valider mes réponses" : "Valider cette étape"}
      </button>
    </div>
  );
}
