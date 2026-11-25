"use client";
import Link from "./workspace-link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CircleCheck,
  CircleX,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, message } from "./request";
import type { Question, Quiz, Attempt, Answer } from "@/lib/study";

export function QuizView({
  quiz,
  questions,
  history,
  attempt,
  answers = [],
}: {
  quiz: Quiz;
  questions: Question[];
  history: Attempt[];
  attempt?: Attempt;
  answers?: Answer[];
}) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [missedOnly, setMissedOnly] = useState(false);
  const [submission] = useState(() => crypto.randomUUID());
  const prompt = useRef<HTMLHeadingElement>(null);
  const answered = Object.keys(chosen).length;
  const q = questions[index];
  const missed = answers.filter((a) => a.chosen !== a.correct).length;
  function goTo(i: number) {
    setIndex(i);
    requestAnimationFrame(() => prompt.current?.focus());
  }
  async function submit() {
    if (
      busy ||
      answered !== questions.length ||
      !window.confirm("Submit your answers for scoring?")
    )
      return;
    setBusy(true);
    setErr("");
    try {
      const r = await api<{ id: string }>("submit", {
        quiz: quiz.id,
        attempt: submission,
        answers: chosen,
      });
      router.push("/dashboard/quizzes/" + quiz.id + "/results/" + r.id);
      router.refresh();
    } catch (e) {
      setErr(message(e));
      setBusy(false);
    }
  }
  return (
    <>
      <div className="study-meta">
        <span>{questions.length} questions</span>
        <span>{quiz.difficulty}</span>
        <small>{quiz.coverage}</small>
      </div>
      {attempt ? (
        <>
          <section className="panel score-panel">
            <div className="score-value">
              {Math.round((100 * attempt.score) / attempt.total)}
              <small>%</small>
            </div>
            <div>
              <h2>
                {attempt.score} / {attempt.total} correct
              </h2>
              <p>
                Completed {new Date(attempt.created_at).toLocaleDateString()}
              </p>
            </div>
            <Link
              className="btn outline"
              href={"/dashboard/quizzes/" + quiz.id}
            >
              <RotateCcw size={15} aria-hidden />
              Try again
            </Link>
          </section>
          <div className="answer-review-head">
            <h2>Answer review</h2>
            <div
              className="review-filter"
              role="group"
              aria-label="Filter answers"
            >
              <button
                aria-pressed={!missedOnly}
                onClick={() => setMissedOnly(false)}
              >
                All ({answers.length})
              </button>
              <button
                aria-pressed={missedOnly}
                onClick={() => setMissedOnly(true)}
              >
                Missed ({missed})
              </button>
            </div>
          </div>
          {missedOnly && !missed && (
            <p className="panel">You answered every question correctly.</p>
          )}
          {questions.map((question, i) => {
            const a = answers.find((v) => v.question_id === question.id);
            if (!a) return null;
            const correct = a.correct === a.chosen;
            if (missedOnly && correct) return null;
            return (
              <article key={question.id} className="panel result-card">
                <div
                  className={"answer-outcome " + (correct ? "right" : "wrong")}
                >
                  {correct ? <CircleCheck size={16} /> : <CircleX size={16} />}{" "}
                  {correct ? "Correct" : "Incorrect"} · Question {i + 1}
                </div>
                <h3>{question.question}</h3>
                <dl className="graded-answers">
                  <div>
                    <dt>Your answer</dt>
                    <dd>{question.options[a.chosen]}</dd>
                  </div>
                  {!correct && (
                    <div>
                      <dt>Correct answer</dt>
                      <dd>{question.options[a.correct]}</dd>
                    </div>
                  )}
                </dl>
                <p>{a.explanation}</p>
                <small className="source-citation">
                  <BookOpen size={15} aria-hidden /> {question.reference}
                </small>
              </article>
            );
          })}
        </>
      ) : q ? (
        <div className="quiz-layout">
          <section className="panel quiz">
            <div className="question-meta">
              <strong>
                Question {index + 1} of {questions.length}
              </strong>
              <span>
                {q.kind === "boolean" ? "True/false" : "Multiple choice"}
              </span>
            </div>
            <h2 ref={prompt} tabIndex={-1} id="quiz-question">
              {q.question}
            </h2>
            <fieldset aria-labelledby="quiz-question" disabled={busy}>
              {q.options.map((option, i) => (
                <label
                  key={q.id + i}
                  className={"answer " + (chosen[q.id] === i ? "selected" : "")}
                >
                  <input
                    type="radio"
                    name={q.id}
                    checked={chosen[q.id] === i}
                    onChange={() => setChosen((v) => ({ ...v, [q.id]: i }))}
                  />
                  <span>{option}</span>
                </label>
              ))}
            </fieldset>
            <div className="quiz-actions">
              <Button
                variant="outline"
                disabled={busy || index === 0}
                onClick={() => goTo(index - 1)}
              >
                <ArrowLeft size={15} aria-hidden />
                Previous
              </Button>
              {index < questions.length - 1 ? (
                <Button disabled={busy} onClick={() => goTo(index + 1)}>
                  Next
                  <ArrowRight size={15} aria-hidden />
                </Button>
              ) : answered < questions.length ? (
                <Button
                  onClick={() =>
                    goTo(
                      questions.findIndex(
                        (item) => chosen[item.id] === undefined,
                      ),
                    )
                  }
                >
                  Next unanswered
                </Button>
              ) : (
                <Button disabled={busy} onClick={submit}>
                  {busy ? "Submitting…" : "Submit quiz"}
                </Button>
              )}
            </div>
            {err && (
              <p role="alert" className="error">
                {err}
              </p>
            )}
          </section>
          <nav className="panel question-map" aria-label="Question navigator">
            <h3>Quiz progress</h3>
            <p aria-live="polite">
              {answered} of {questions.length} answered
            </p>
            <progress
              aria-label="Questions answered"
              value={answered}
              max={questions.length}
            />
            <div className="question-numbers">
              {questions.map((item, i) => (
                <button
                  key={item.id}
                  className={chosen[item.id] !== undefined ? "is-answered" : ""}
                  aria-current={index === i ? "step" : undefined}
                  aria-label={
                    "Question " +
                    (i + 1) +
                    (chosen[item.id] !== undefined
                      ? ", answered"
                      : ", unanswered")
                  }
                  disabled={busy}
                  onClick={() => goTo(i)}
                >
                  {i + 1}
                  {chosen[item.id] !== undefined && (
                    <Check size={10} aria-hidden />
                  )}
                </button>
              ))}
            </div>
            {answered === questions.length &&
              index !== questions.length - 1 && (
                <button
                  className="text-btn"
                  onClick={() => goTo(questions.length - 1)}
                >
                  Go to submission <ArrowRight size={14} />
                </button>
              )}
          </nav>
        </div>
      ) : (
        <p className="panel">This quiz has no questions yet.</p>
      )}
      {history.length > 0 && (
        <section className="panel">
          <h2>Previous attempts</h2>
          {history.map((a) => (
            <Link
              className="list-row"
              key={a.id}
              href={"/dashboard/quizzes/" + quiz.id + "/results/" + a.id}
            >
              <strong>
                {a.score} / {a.total}
              </strong>
              <small>{new Date(a.created_at).toLocaleString()}</small>
              <ArrowRight size={15} aria-hidden />
            </Link>
          ))}
        </section>
      )}
    </>
  );
}
