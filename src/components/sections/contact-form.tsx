"use client";

import { useActionState, useEffect, useRef } from "react";
import { submitContact, type ContactState } from "@/lib/actions/contact";
import { useToast } from "@/components/ui/toast";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/locale-provider";
import type { Locale } from "@/lib/i18n/config";

const INITIAL: ContactState = { status: "idle" };

const inputClass =
  "rounded-md border border-ash bg-abyss px-3.5 py-2.5 text-bone outline-none transition-colors placeholder:text-smoke/60 focus-visible:border-signal";

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-label text-smoke font-mono uppercase">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-term-red text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function ContactForm({ locale }: { locale: Locale }) {
  const [state, formAction, pending] = useActionState(submitContact, INITIAL);
  const { dict } = useI18n();
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const t = dict.contactForm;

  useEffect(() => {
    if (state.status === "success") {
      toast(state.message ?? t.fallbackSuccess);
      formRef.current?.reset();
    }
  }, [state, toast, t.fallbackSuccess]);

  const fe = state.fieldErrors;

  return (
    <form
      ref={formRef}
      action={formAction}
      aria-busy={pending}
      className="flex w-full max-w-md flex-col gap-4"
    >
      {/* The action runs on the server, where the URL is not available — this
          is how it knows which locale to answer in. */}
      <input type="hidden" name="locale" value={locale} />

      {/* Honeypot — visually hidden, off the tab order. */}
      <div
        aria-hidden
        className="absolute -left-[9999px] h-0 w-0 overflow-hidden"
      >
        <label htmlFor="website">{t.honeypot}</label>
        <input
          id="website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <Field id="name" label={t.name} error={fe?.name?.[0]}>
        <input
          id="name"
          name="name"
          type="text"
          required
          autoComplete="name"
          aria-describedby={fe?.name ? "name-error" : undefined}
          className={inputClass}
        />
      </Field>

      <Field id="email" label={t.email} error={fe?.email?.[0]}>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          aria-describedby={fe?.email ? "email-error" : undefined}
          className={inputClass}
        />
      </Field>

      <Field id="message" label={t.message} error={fe?.message?.[0]}>
        <textarea
          id="message"
          name="message"
          required
          rows={4}
          aria-describedby={fe?.message ? "message-error" : undefined}
          className={cn(inputClass, "resize-y")}
        />
      </Field>

      <button
        type="submit"
        disabled={pending}
        className={cn(buttonVariants({ variant: "primary", size: "lg" }))}
      >
        {pending ? t.sending : t.submit}
      </button>

      {state.status === "error" && !fe ? (
        <p role="alert" className="text-term-red text-sm">
          {state.message}
        </p>
      ) : null}
      <p aria-live="polite" className="sr-only">
        {state.status === "success" ? state.message : ""}
      </p>
    </form>
  );
}
