"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";

const copy = {
  login: ["Welcome back", "Sign in to your study workspace.", "Sign in"],
  register: [
    "Create your account",
    "Start organizing your courses in StudySync.",
    "Create account",
  ],
  recovery: [
    "Reset your password",
    "Enter your account email to request a reset link.",
    "Send reset link",
  ],
  update: [
    "Choose a new password",
    "Use at least eight characters.",
    "Save password",
  ],
} as const;
type Mode = keyof typeof copy;
type Fields = { name: string; email: string; password: string };
export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<Fields>();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [title, description, button] = copy[mode];
  async function submit(values: Fields) {
    setMessage("");
    setError("");
    const email = values.email?.trim();
    if (mode !== "update" && !z.email().safeParse(email).success) {
      setError("Enter a valid email address.");
      return;
    }
    if (mode === "register" && !values.name.trim()) {
      setError("Enter your full name.");
      return;
    }
    const auth = createClient().auth;
    const callback = window.location.origin + "/auth/callback";
    try {
      if (mode === "register") {
        const { data, error } = await auth.signUp({
          email,
          password: values.password,
          options: {
            data: { full_name: values.name.trim() },
            emailRedirectTo: callback,
          },
        });
        if (error) throw error;
        if (!data.session) {
          setMessage(
            "Check your inbox for the confirmation link, then sign in.",
          );
          return;
        }
      } else if (mode === "recovery") {
        const { error } = await auth.resetPasswordForEmail(email, {
          redirectTo: callback + "?flow=recovery",
        });
        if (error) throw error;
        setMessage(
          "If an account exists, a reset link is on its way. Open it in this browser.",
        );
        return;
      } else if (mode === "update") {
        const { error } = await auth.updateUser({ password: values.password });
        if (error) throw error;
      } else {
        const { error } = await auth.signInWithPassword({
          email,
          password: values.password,
        });
        if (error) throw error;
      }
      router.replace("/dashboard");
      router.refresh();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to reach authentication. Please try again.",
      );
    }
  }
  return (
    <main className="auth-page">
      <Brand />
      <section className="auth-card">
        <h1>{title}</h1>
        <p>{description}</p>
        <form onSubmit={handleSubmit(submit)}>
          {mode === "register" && (
            <label>
              Full name
              <input
                {...register("name")}
                autoComplete="name"
                maxLength={100}
                required
              />
            </label>
          )}
          {mode !== "update" && (
            <label>
              Email
              <input
                type="email"
                {...register("email")}
                autoComplete="email"
                required
                maxLength={254}
              />
            </label>
          )}
          {mode !== "recovery" && (
            <label>
              Password
              <input
                type="password"
                {...register("password")}
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                required
                minLength={mode === "login" ? 1 : 8}
                maxLength={256}
              />
            </label>
          )}
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          {message && (
            <p role="status" className="notice">
              {message}
            </p>
          )}
          <Button disabled={isSubmitting}>
            {isSubmitting ? "Please wait…" : button}
          </Button>
        </form>
        {mode === "login" ? (
          <div className="auth-links">
            <Link href="/forgot-password">Forgot password?</Link>
            <Link href="/register">Create an account</Link>
          </div>
        ) : (
          <Link href="/login">Back to sign in</Link>
        )}
      </section>
    </main>
  );
}
