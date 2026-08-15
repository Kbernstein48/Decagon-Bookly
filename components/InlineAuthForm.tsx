"use client";

import { KeyRound, LockKeyhole, Mail, ShieldCheck, X } from "lucide-react";
import { FormEvent, useEffect, useId, useRef, useState } from "react";

export type InlineAuthCredentials = {
  email: string;
  password: string;
};

export type InlineAuthFormProps = {
  title?: string;
  description?: string;
  eyebrow?: string;
  submitLabel?: string;
  submittingLabel?: string;
  demoEmail?: string;
  error?: string;
  submitting?: boolean;
  onSubmit: (credentials: InlineAuthCredentials) => void | Promise<void>;
  onCancel?: () => void;
};

export function InlineAuthForm({
  title = "Sign in to continue",
  description = "Enter the email from your order and your password.",
  eyebrow = "Private account access",
  submitLabel = "Sign in",
  submittingLabel = "Signing inâ€¦",
  demoEmail,
  error,
  submitting = false,
  onSubmit,
  onCancel,
}: InlineAuthFormProps) {
  const id = useId();
  const emailRef = useRef<HTMLInputElement | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => { emailRef.current?.focus(); }, []);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim() || !password || submitting) return;
    void onSubmit({ email: email.trim(), password });
  };

  return (
    <section className="inline-auth-card" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}>
      {onCancel && (
        <button className="inline-auth-close" type="button" onClick={onCancel} disabled={submitting} aria-label="Cancel sign-in">
          <X size={15} />
        </button>
      )}
      <div className="inline-auth-heading">
        <div className="inline-auth-icon"><LockKeyhole size={18} /></div>
        <div>
          <p className="auth-eyebrow">{eyebrow}</p>
          <h3 id={`${id}-title`}>{title}</h3>
        </div>
      </div>
      <p className="inline-auth-description" id={`${id}-description`}>{description}</p>
      <form onSubmit={handleSubmit}>
        <label htmlFor={`${id}-email`}>Email address</label>
        <div className="auth-field">
          <Mail size={15} />
          <input
            ref={emailRef}
            id={`${id}-email`}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            placeholder="you@example.com"
            required
            disabled={submitting}
            aria-invalid={Boolean(error)}
          />
        </div>
        <label htmlFor={`${id}-password`}>Password</label>
        <div className="auth-field">
          <KeyRound size={15} />
          <input
            id={`${id}-password`}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            placeholder="Enter any password"
            required
            disabled={submitting}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${id}-error` : undefined}
          />
        </div>
        {error && <p className="auth-error" id={`${id}-error`} role="alert">{error}</p>}
        <button className="auth-submit" type="submit" disabled={submitting || !email.trim() || !password}>
          {submitting ? submittingLabel : submitLabel}
        </button>
        {demoEmail && (
          <button className="auth-demo-account" type="button" onClick={() => { setEmail(demoEmail); emailRef.current?.focus(); }} disabled={submitting}>
            Use demo email: {demoEmail}
          </button>
        )}
      </form>
      <p className="auth-demo-note"><ShieldCheck size={12} /> Demo accepts any non-empty password. It is never shared with the agent.</p>
    </section>
  );
}
