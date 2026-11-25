import Link from "next/link";
import { Brand } from "@/components/brand";
export default function Page() {
  return (
    <main className="auth-page">
      <Brand />
      <section className="auth-card">
        <h1>This link is unavailable</h1>
        <p>Confirming an account? Request a fresh confirmation email. For a password reset, open the newest reset link in the browser where you requested it.</p>
        <Link href="/verify-email">Verify your email</Link>
        <Link href="/forgot-password">Request a password reset</Link>
        <Link href="/login">Return to sign in</Link>
      </section>
    </main>
  );
}
