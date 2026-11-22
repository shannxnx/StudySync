"use client";
import { Button } from "@/components/ui/button";
export default function ErrorView({ reset }: { reset: () => void }) {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <h1>Your workspace could not load</h1>
        <p>
          Check your connection and try again. Your saved work is stored in
          Supabase.
        </p>
        <Button onClick={reset}>Try again</Button>
      </section>
    </main>
  );
}
