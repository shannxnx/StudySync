"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AuthLayout } from "./auth-layout";
import { rememberConfirmation } from "./confirmation-state";
import { Button } from "./ui/button";

const copy = {
  login: ["Welcome back", "Sign in to your StudySync workspace.", "Sign in"],
  register: ["Create your account", "Use your email and a password. We’ll email you to confirm your address.", "Create account"],
  recovery: ["Reset your password", "We’ll email you a link to choose a new password.", "Send reset link"],
  update: ["Choose a new password", "Your new password will be ready to use the next time you sign in.", "Save password"],
} as const;

export function AuthForm({ mode }: { mode: keyof typeof copy }) {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [title, description, action] = copy[mode];
  const newPassword = mode === "register" || mode === "update";
  const titleId = mode + "-title";
  const emailId = mode + "-email";
  const passwordId = mode + "-password";
  const tipId = mode + "-password-tip";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const fields = new FormData(event.currentTarget);
    const email = String(fields.get("email") || "").trim();
    const password = String(fields.get("password") || "");
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const auth = createClient().auth;
      const callback = window.location.origin + "/auth/callback";
      if (mode === "register") {
        const { data, error } = await auth.signUp({ email, password, options: { emailRedirectTo: callback } });
        if (error) throw error;
        if (!data.session) {
          rememberConfirmation(email, true);
          router.push("/verify-email");
          return;
        }
      } else if (mode === "login") {
        const { error } = await auth.signInWithPassword({ email, password });
        if (error?.code === "invalid_credentials") {
          setError("Incorrect email or password. Check both and try again.");
          return;
        }
        if (error?.code === "email_not_confirmed") {
          rememberConfirmation(email, false);
          router.push("/verify-email");
          return;
        }
        if (error) throw error;
      } else if (mode === "recovery") {
        const { error } = await auth.resetPasswordForEmail(email, { redirectTo: callback + "?flow=recovery" });
        if (error) throw error;
        setNotice("If an account exists for that email, a reset link is on its way. Open the link in this browser.");
        return;
      } else {
        const { error } = await auth.updateUser({ password });
        if (error) throw error;
      }
      router.replace("/dashboard");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "We couldn’t connect. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout titleId={titleId}>
      <h1 id={titleId}>{title}</h1>
      <p className="account-intro">{description}</p>
      <form className="account-form" onSubmit={submit}>
        {mode !== "update" && (
          <div className="account-field">
            <label htmlFor={emailId}>Email</label>
            <input id={emailId} name="email" type="email" autoComplete="email" autoCapitalize="none"
              spellCheck={false} required maxLength={254} placeholder="you@example.com" />
          </div>
        )}
        {mode !== "recovery" && (
          <div className="account-field">
            <div className="account-label">
              <label htmlFor={passwordId}>Password</label>
              {mode === "login" && <Link className="account-link" href="/forgot-password">Forgot password?</Link>}
            </div>
            <div className="account-password">
              <input id={passwordId} name="password" type={visible ? "text" : "password"}
                autoComplete={newPassword ? "new-password" : "current-password"} required
                minLength={newPassword ? 8 : 1} maxLength={256} aria-describedby={newPassword ? tipId : undefined} />
              <button className="account-eye" type="button" aria-label={visible ? "Hide password" : "Show password"}
                aria-controls={passwordId} onClick={() => setVisible(!visible)}>
                {visible ? <EyeOff size={19} aria-hidden /> : <Eye size={19} aria-hidden />}
              </button>
            </div>
            {newPassword && <p className="account-help" id={tipId}>Use at least 8 characters.</p>}
          </div>
        )}
        {error && <p role="alert" className="error account-feedback">{error}</p>}
        {notice && <p role="status" className="notice account-feedback">{notice}</p>}
        <Button className="account-action" disabled={busy}>{busy ? "Please wait…" : action}<ArrowRight size={17} aria-hidden /></Button>
      </form>
      <div className="account-footer">
        {mode === "login" ? (
          <p>New to StudySync? <Link className="account-link" href="/register">Create an account</Link></p>
        ) : (
          <p>{mode === "register" && "Already have an account? "}<Link className="account-link" href="/login">{mode === "register" ? "Sign in" : "Back to sign in"}</Link></p>
        )}
        {mode === "register" && <Link className="account-link" href="/verify-email">I already have a verification code</Link>}
      </div>
    </AuthLayout>
  );
}
