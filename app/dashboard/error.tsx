"use client";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { startTransition } from "react";
export default function ErrorView({ reset }: { reset: () => void }) {
  const router = useRouter();
  return (
    <div className="workspace-page" role="alert">
      <section className="panel">
        <h1>Your workspace could not load</h1>
        <p>
          Check your connection and try again. Your saved work is stored in
          Supabase.
        </p>
        <Button
          onClick={() =>
            startTransition(() => {
              router.refresh();
              reset();
            })
          }
        >
          Try again
        </Button>
      </section>
    </div>
  );
}
