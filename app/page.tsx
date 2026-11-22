import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Files, NotebookPen, ListChecks } from "lucide-react";
import { Brand } from "@/components/brand";

const steps = [
  {
    icon: Files,
    title: "Collect your materials",
    detail: "Keep readings, lecture slides, and notes together by subject.",
  },
  {
    icon: NotebookPen,
    title: "Review with context",
    detail: "Build a reviewer with citations back to the material you chose.",
  },
  {
    icon: ListChecks,
    title: "Practice at your pace",
    detail: "Take a quiz, understand each answer, and revisit past attempts.",
  },
];

export default function Home() {
  return (
    <main className="landing">
      <header>
        <Brand />
        <nav aria-label="Main navigation">
          <a href="#study-session">How it works</a>
          <Link className="btn outline" href="/login">
            Sign in <ArrowRight size={15} />
          </Link>
        </nav>
      </header>
      <section className="hero">
        <div className="hero-copy">
          <h1>
            Organize smarter.
            <br />
            <em>Study better.</em>
          </h1>
          <p>
            Keep course files and notes together. Turn your own material into
            cited reviewers and practice quizzes.
          </p>
          <Link className="btn primary" href="/register">
            Create your workspace <ArrowRight size={17} />
          </Link>
        </div>
        <div className="hero-art">
          <Image
            src="/study-notebooks-maroon.webp"
            alt="Maroon linen notebook with a gold StudySync mark beside a silver pen"
            width={1536}
            height={1024}
            preload
            sizes="(max-width: 800px) 100vw, 48vw"
          />
        </div>
      </section>
      <section
        id="study-session"
        className="study-session"
        aria-label="How StudySync works"
      >
        {steps.map(({ icon: Icon, title, detail }) => (
          <article key={title}>
            <span className="step-icon">
              <Icon size={20} />
            </span>
            <h2>{title}</h2>
            <p>{detail}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
