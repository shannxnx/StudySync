"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Check,
  LockKeyhole,
  Monitor,
  Moon,
  Palette,
  Sun,
  UserRound,
} from "lucide-react";
import type { Profile } from "@/lib/study";
import { formatDate } from "./collections";
import { Button } from "./ui/button";
import { api, message } from "./request";
import { useThemePreference, setThemePreference } from "./theme-preference";
import "./account-settings.css";

const themes = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
] as const;

export function AccountSettings({ profile }: { profile: Profile }) {
  const router = useRouter();
  const theme = useThemePreference();
  const [name, setName] = useState(profile.full_name);
  const [savedName, setSavedName] = useState(profile.full_name);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const trimmed = name.trim();
  const changed = trimmed !== savedName;
  const initials = (savedName || profile.email)
    .trim()
    .split(/\s+/u)
    .slice(0, 2)
    .map((word) => Array.from(word)[0])
    .join("")
    .toUpperCase();
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !trimmed || !changed) return;
    setSaving(true);
    setStatus("");
    setError("");
    try {
      await api("profile", { name: trimmed });
      setSavedName(trimmed);
      setName(trimmed);
      setStatus("Profile saved.");
      router.refresh();
    } catch (e) {
      setError(message(e));
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="settings-page">
      <header className="settings-heading">
        <h1>Settings</h1>
        <p>Manage your profile, workspace appearance, and password.</p>
      </header>
      <div className="settings-grid">
        <section
          className="settings-card settings-profile"
          aria-labelledby="profile-heading"
        >
          <header>
            <UserRound aria-hidden size={19} />
            <h2 id="profile-heading">Profile</h2>
          </header>
          <div className="settings-identity">
            <span aria-hidden>{initials}</span>
            <div>
              <strong>{savedName || profile.email}</strong>
              <small>Member since {formatDate(profile.created_at)}</small>
            </div>
          </div>
          <form onSubmit={save}>
            <label>
              Full name
              <input
                name="name"
                autoComplete="name"
                required
                maxLength={100}
                value={name}
                disabled={saving}
                onChange={(e) => {
                  setName(e.target.value);
                  setStatus("");
                  setError("");
                }}
              />
            </label>
            <label>
              Email address
              <input name="email" type="email" value={profile.email} readOnly />
            </label>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <div className="settings-save">
              <span role="status">{status}</span>
              <Button disabled={saving || !trimmed || !changed}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </form>
        </section>
        <div className="settings-side">
          <section
            className="settings-card"
            aria-labelledby="appearance-heading"
          >
            <header>
              <Palette size={19} aria-hidden />
              <h2 id="appearance-heading">Appearance</h2>
            </header>
            <p>Choose a theme for this device.</p>
            <fieldset
              className="theme-options"
              aria-labelledby="appearance-heading"
            >
              {themes.map(({ value, label, icon: Icon }) => (
                <label key={value} className="theme-option">
                  <input
                    type="radio"
                    name="theme"
                    value={value}
                    checked={theme === value}
                    onChange={() => setThemePreference(value)}
                  />
                  <span
                    className={"theme-preview preview-" + value}
                    aria-hidden
                  >
                    <i />
                    <b />
                    <b />
                  </span>
                  <span className="theme-name">
                    <Icon size={14} aria-hidden />
                    {label}
                    {theme === value && <Check size={14} aria-hidden />}
                  </span>
                </label>
              ))}
            </fieldset>
          </section>
          <section className="settings-card" aria-labelledby="security-heading">
            <header>
              <LockKeyhole size={19} aria-hidden />
              <h2 id="security-heading">Security</h2>
            </header>
            <div className="settings-security">
              <div>
                <strong>Password</strong>
                <p>Request a reset link by email.</p>
              </div>
              <Link className="btn outline" href="/forgot-password">
                Reset password <ArrowUpRight size={15} aria-hidden />
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
