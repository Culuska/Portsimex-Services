"use client";

import { useState } from "react";
import { contact } from "@/lib/content";

export default function ContactForm() {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [need, setNeed] = useState("");
  const [message, setMessage] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const subject = `Quote request${company ? ` — ${company}` : ""}`;
    const body = [
      `Name: ${name}`,
      company && `Company: ${company}`,
      need && `What needs to move: ${need}`,
      "",
      message,
    ]
      .filter(Boolean)
      .join("\n");
    window.location.href = `mailto:${contact.email}?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(body)}`;
  }

  const fieldClass =
    "w-full rounded-sm border border-ink-line bg-ink px-4 py-3 text-sm text-paper placeholder:text-paper-dim/60 outline-none transition-colors focus:border-accent";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="name" className="text-xs font-medium text-paper-dim">
            Your name
          </label>
          <input
            id="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={fieldClass}
            placeholder="Ahmed Hassan"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="company"
            className="text-xs font-medium text-paper-dim"
          >
            Company
          </label>
          <input
            id="company"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            className={fieldClass}
            placeholder="Optional"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="need" className="text-xs font-medium text-paper-dim">
          What needs to move
        </label>
        <input
          id="need"
          value={need}
          onChange={(e) => setNeed(e.target.value)}
          className={fieldClass}
          placeholder="e.g. 2x20ft containers, Dubai to Mogadishu"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="message"
          className="text-xs font-medium text-paper-dim"
        >
          Details
        </label>
        <textarea
          id="message"
          required
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className={fieldClass}
          placeholder="Timeline, cargo type, origin and destination — whatever's useful."
        />
      </div>

      <button
        type="submit"
        className="mt-2 w-fit rounded-sm bg-accent px-6 py-3 text-sm font-semibold text-paper transition-colors hover:bg-accent-strong"
      >
        Send request
      </button>
      <p className="text-xs text-paper-dim">
        Opens your email client, addressed to {contact.email}.
      </p>
    </form>
  );
}
