import type { ReactNode } from "react";
import Image from "next/image";
import { Brand } from "@/components/brand";
import "./auth.css";

export function AuthLayout({ children, titleId }: { children: ReactNode; titleId: string }) {
  return (
    <main className="account-page">
      <div className="account-shell">
        <section className="account-content" aria-labelledby={titleId}>
          <Brand />
          <div className="account-body">{children}</div>
        </section>
        <figure className="account-aside">
          <div className="account-photo">
            <Image src="/study-notebooks-maroon.webp" alt="" fill sizes="(min-width: 800px) 46vw, 0px" />
          </div>
          <figcaption className="account-caption">
            <h2>Your study workspace</h2>
            <p>Keep course files and notes together, then turn them into practice quizzes.</p>
          </figcaption>
        </figure>
      </div>
    </main>
  );
}
