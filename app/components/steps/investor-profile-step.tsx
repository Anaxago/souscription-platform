import { useState, useEffect } from "react";

interface Props {
  journeyId: string;
  stepId: string;
  investorId: string;
  personKernelId: string;
  investorType: string;
  requiredCategories: string[] | null;
  actionUrl: string;
  onComplete: () => void;
}

interface Question {
  id: string;
  version: number;
  category: string;
  applicableTo: "INDIVIDUAL" | "LEGAL_ENTITY" | "BOTH";
  wording: string;
  type: "SINGLE_CHOICE" | "MULTIPLE_CHOICE";
  choices: { choiceId: string; label: string }[];
}

interface GroupedCategory {
  category: string;
  label: string;
  questions: Question[];
}

const CATEGORY_LABELS: Record<string, string> = {
  KNOWLEDGE: "Connaissances financières",
  EXPERIENCE: "Expérience d'investissement",
  FINANCIAL_SITUATION: "Situation financière",
  OBJECTIVE: "Objectifs d'investissement",
  HORIZON: "Horizon de placement",
  LOSS_CAPACITY: "Capacité de perte",
  ESG_PREFERENCE: "Préférences ESG",
  RISK_PROFILE: "Profil de risque",
  MIFID_CLASSIFICATION: "Classification MiFID",
};

// Order categories for a natural flow
const CATEGORY_ORDER = [
  "FINANCIAL_SITUATION",
  "OBJECTIVE",
  "HORIZON",
  "LOSS_CAPACITY",
  "EXPERIENCE",
  "KNOWLEDGE",
  "ESG_PREFERENCE",
];

export default function InvestorProfileStep({
  journeyId,
  stepId,
  investorId,
  personKernelId,
  investorType,
  requiredCategories,
  actionUrl,
  onComplete,
}: Props) {
  const [categories, setCategories] = useState<GroupedCategory[]>([]);
  const [currentCatIndex, setCurrentCatIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [loading, setLoading] = useState(true);
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

  // Fetch assessment questions on mount
  useEffect(() => {
    async function fetchQuestions() {
      try {
        const result = await callAction({ type: "fetch-assessment-questions" });
        const questions = (result as { data: Question[] }).data ?? (result as Question[]);
        const qList = Array.isArray(questions) ? questions : [];

        // Filter by applicableTo based on investor type
        const applicableTarget = investorType === "LEGAL" ? "LEGAL_ENTITY" : "INDIVIDUAL";
        const byApplicable = qList.filter(
          (q) => q.applicableTo === applicableTarget || q.applicableTo === "BOTH"
        );

        // Filter by required categories if specified
        const filtered = requiredCategories && requiredCategories.length > 0
          ? byApplicable.filter((q) => requiredCategories.includes(q.category))
          : byApplicable;

        // Group by category and order
        const grouped = new Map<string, Question[]>();
        for (const q of filtered) {
          const existing = grouped.get(q.category) ?? [];
          existing.push(q);
          grouped.set(q.category, existing);
        }

        const ordered: GroupedCategory[] = [];
        for (const cat of CATEGORY_ORDER) {
          const qs = grouped.get(cat);
          if (qs && qs.length > 0) {
            ordered.push({
              category: cat,
              label: CATEGORY_LABELS[cat] ?? cat,
              questions: qs,
            });
          }
        }
        // Add any remaining categories not in the order
        for (const [cat, qs] of grouped) {
          if (!CATEGORY_ORDER.includes(cat) && qs.length > 0) {
            ordered.push({
              category: cat,
              label: CATEGORY_LABELS[cat] ?? cat,
              questions: qs,
            });
          }
        }

        setCategories(ordered);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur chargement questions");
      } finally {
        setLoading(false);
      }
    }
    fetchQuestions();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentCat = categories[currentCatIndex];
  const isLastCategory = currentCatIndex === categories.length - 1;
  const totalQuestions = categories.reduce((sum, c) => sum + c.questions.length, 0);
  const answeredCount = Object.keys(answers).length;
  const questionsBeforeCurrent = categories.slice(0, currentCatIndex).reduce((sum, c) => sum + c.questions.length, 0);

  function allQuestionsAnsweredInCategory(cat: GroupedCategory): boolean {
    return cat.questions.every((q) => {
      const a = answers[q.id];
      if (q.type === "MULTIPLE_CHOICE") return Array.isArray(a) && a.length > 0;
      return typeof a === "string" && a.length > 0;
    });
  }

  function handleSingleAnswer(questionId: string, choiceKey: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: choiceKey }));
  }

  function handleMultipleAnswer(questionId: string, choiceKey: string) {
    setAnswers((prev) => {
      const current = (prev[questionId] as string[]) ?? [];
      const next = current.includes(choiceKey)
        ? current.filter((k) => k !== choiceKey)
        : [...current, choiceKey];
      return { ...prev, [questionId]: next };
    });
  }

  async function handleNextCategory() {
    if (!currentCat) return;

    setSubmitting(true);
    setError(null);
    try {
      // Submit this category's answers via the assessment API
      await callAction({
        type: "submit-assessment-category",
        investorId,
        personKernelId,
        investorType,
        category: currentCat.category,
        answers: currentCat.questions.map((q) => ({
          questionId: q.id,
          questionVersion: q.version,
          questionWordingSnapshot: q.wording,
          answerValue: answers[q.id],
        })),
      });

      if (isLastCategory) {
        // Submit empty sessions for required categories that have no questions
        if (requiredCategories) {
          const coveredCategories = categories.map((c) => c.category);
          const missingCategories = requiredCategories.filter((c) => !coveredCategories.includes(c));
          for (const cat of missingCategories) {
            try {
              await callAction({
                type: "submit-assessment-category",
                investorId,
                personKernelId,
                investorType,
                category: cat,
                answers: [],
              });
            } catch {
              // Ignore errors for empty categories
            }
          }
        }
        // All categories done — re-fetch journey to check if step auto-completed
        onComplete();
      } else {
        setCurrentCatIndex((i) => i + 1);
      }
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
          Chargement du questionnaire...
        </p>
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className="step-panel">
        <div className="step-panel__header">
          <div className="step-panel__icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--clr-primary)" strokeWidth="1.5">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <div>
            <h2 className="step-panel__title">Profil investisseur</h2>
            <p className="step-panel__desc">Aucune question de profilage n'est configurée.</p>
          </div>
        </div>
        <button className="btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={onComplete}>
          Continuer
        </button>
      </div>
    );
  }

  return (
    <div className="step-panel">
      <div className="step-panel__header">
        <div className="step-panel__icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--clr-primary)" strokeWidth="1.5">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
          </svg>
        </div>
        <div>
          <h2 className="step-panel__title">{currentCat?.label}</h2>
          <p className="step-panel__desc">
            Catégorie {currentCatIndex + 1} sur {categories.length} — {answeredCount}/{totalQuestions} questions répondues
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ marginBottom: "var(--space-lg)" }}>
        <div style={{
          height: 4,
          borderRadius: 2,
          background: "var(--clr-stroke-dark)",
          overflow: "hidden",
        }}>
          <div style={{
            height: "100%",
            width: `${((currentCatIndex + 1) / categories.length) * 100}%`,
            background: "var(--clr-primary)",
            borderRadius: 2,
            transition: "width 0.3s ease",
          }} />
        </div>
      </div>

      {error && <div className="form-error" style={{ marginBottom: "var(--space-md)" }}>{error}</div>}

      {/* Questions */}
      {currentCat && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-lg)" }}>
          {currentCat.questions.map((q, qi) => (
            <div key={q.id}>
              <label className="form-label" style={{ fontSize: 13, textTransform: "none", letterSpacing: "normal" }}>
                {questionsBeforeCurrent + qi + 1}. {q.wording}
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
                {q.choices.map((choice) => {
                  const isSelected = q.type === "MULTIPLE_CHOICE"
                    ? ((answers[q.id] as string[]) ?? []).includes(choice.choiceId)
                    : answers[q.id] === choice.choiceId;

                  return (
                    <label
                      key={choice.choiceId}
                      className="choice-card"
                      style={{
                        borderColor: isSelected ? "var(--clr-primary)" : undefined,
                        background: isSelected ? "var(--clr-primary-light)" : undefined,
                      }}
                    >
                      <input
                        type={q.type === "MULTIPLE_CHOICE" ? "checkbox" : "radio"}
                        name={q.id}
                        checked={isSelected}
                        onChange={() =>
                          q.type === "MULTIPLE_CHOICE"
                            ? handleMultipleAnswer(q.id, choice.choiceId)
                            : handleSingleAnswer(q.id, choice.choiceId)
                        }
                        style={{ display: "none" }}
                      />
                      {q.type === "MULTIPLE_CHOICE" ? (
                        <span className="choice-card__check" style={{ borderColor: isSelected ? "var(--clr-primary)" : undefined }}>
                          {isSelected && (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--clr-primary)" strokeWidth="3">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </span>
                      ) : (
                        <span className="choice-card__radio" style={{ borderColor: isSelected ? "var(--clr-primary)" : undefined }}>
                          {isSelected && <span className="choice-card__radio-dot" />}
                        </span>
                      )}
                      <span className="choice-card__label">{choice.label}</span>
                    </label>
                  );
                })}
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
          opacity: currentCat && allQuestionsAnsweredInCategory(currentCat) && !submitting ? 1 : 0.5,
        }}
        disabled={!currentCat || !allQuestionsAnsweredInCategory(currentCat) || submitting}
        onClick={handleNextCategory}
      >
        {submitting ? "Enregistrement..." : isLastCategory ? "Valider mon profil" : "Catégorie suivante"}
      </button>

      {currentCatIndex > 0 && (
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
            width: "100%",
            marginTop: "var(--space-sm)",
          }}
          onClick={() => setCurrentCatIndex((i) => i - 1)}
        >
          ← Catégorie précédente
        </button>
      )}
    </div>
  );
}
