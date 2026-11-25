"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AuthLayout } from "./auth-layout";
import { clearConfirmation, readConfirmation, rememberConfirmation } from "./confirmation-state";
import { Button } from "./ui/button";

const resendDelay = 60;

export function VerifyEmail() {
  const router = useRouter();
  const emailField = useRef<HTMLInputElement>(null);
  const codeField = useRef<HTMLInputElement>(null);
  const [pendingAction, setPendingAction] = useState<"verify" | "resend" | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const pending = readConfirmation();
    if (pending.email && emailField.current) {
      emailField.current.value = pending.email;
      codeField.current?.focus();
    }
    function updateCooldown() {
      const last = readConfirmation();
      const matches = last.email === emailField.current?.value.trim();
      setSeconds(matches ? Math.max(0, resendDelay - Math.floor((Date.now() - last.sentAt) / 1000)) : 0);
    }
    updateCooldown();
    const timer = window.setInterval(updateCooldown, 1000);
    return () => window.clearInterval(timer);
  }, []);

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingAction || !emailField.current || !codeField.current) return;
    const email = emailField.current.value.trim();
    const token = codeField.current.value.replace(/\s/g, "");
    setError("");
    setNotice("");
    if (!/^\d{6,10}$/.test(token)) {
      setError("Enter all the digits from your verification email.");
      codeField.current.focus();
      return;
    }
    setPendingAction("verify");
    try {
      const { data, error } = await createClient().auth.verifyOtp({ email, token, type: "email" });
      if (error?.code === "otp_expired") {
        setError("That code is incorrect or has expired. Try the newest code, or request a new one.");
        codeField.current?.select();
        return;
      }
      if (error) throw error;
      if (!data.session) throw new Error("We couldn’t start your session. Please sign in again.");
      clearConfirmation();
      router.replace("/dashboard");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "We couldn’t verify that code. Please try again.");
    } finally {
      setPendingAction(null);
    }
  }

  async function resend() {
    if (pendingAction || seconds > 0 || !emailField.current?.reportValidity()) return;
    const email = emailField.current.value.trim();
    setPendingAction("resend");
    setError("");
    setNotice("");
    try {
      const { error } = await createClient().auth.resend({
        type: "signup", email, options: { emailRedirectTo: window.location.origin + "/auth/callback" },
      });
      if (error) throw error;
      rememberConfirmation(email, true);
      setSeconds(resendDelay);
      setNotice("If this address is awaiting confirmation, a new email is on its way. Check your inbox and spam folder.");
      if (codeField.current) {
        codeField.current.value = "";
        codeField.current.focus();
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "We couldn’t resend the email. Please try again.");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <AuthLayout titleId="verify-title">
      <h1 id="verify-title">Verify your email</h1>
      <p className="account-intro">Check your latest StudySync email. Open its confirmation link in this browser, or enter the code below if your email includes one.</p>
      <form className="account-form" onSubmit={verify}>
        <div className="account-field">
          <label htmlFor="verify-email">Email</label>
          <input ref={emailField} id="verify-email" name="email" type="email" autoComplete="email"
            autoCapitalize="none" spellCheck={false} required maxLength={254} placeholder="you@example.com" />
        </div>
        <div className="account-field">
          <label htmlFor="verify-code">Verification code</label>
          <input ref={codeField} className="account-code" id="verify-code" name="code" type="text"
            inputMode="numeric" autoComplete="one-time-code" spellCheck={false} required maxLength={24} />
        </div>
        {error && <p className="error account-feedback" role="alert">{error}</p>}
        {notice && <p className="notice account-feedback" role="status">{notice}</p>}
        <Button className="account-action" disabled={!!pendingAction}>{pendingAction === "verify" ? "Verifying…" : "Verify email"}<ArrowRight size={17} aria-hidden /></Button>
        <div className="account-tools">
          <span className="account-help">Didn’t get the email?</span>
          <button type="button" className="account-link" disabled={!!pendingAction || seconds > 0} onClick={resend}>
            {pendingAction === "resend" ? "Sending…" : seconds > 0 ? `Resend in ${seconds}s` : "Resend email"}
          </button>
        </div>
      </form>
      <div className="account-footer"><Link className="account-link" href="/login">Back to sign in</Link></div>
    </AuthLayout>
  );
}
