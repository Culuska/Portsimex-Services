"use client";

import { useState } from "react";
import { contact, services } from "@/lib/content";

export default function ContactForm() {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [service, setService] = useState("");
  const [need, setNeed] = useState("");
  const [message, setMessage] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const subject = `Quote request${service ? ` — ${service}` : ""}${company ? ` — ${company}` : ""}`;
    const body = [
      `Name: ${name}`,
      company && `Company: ${company}`,
      service && `Service: ${service}`,
      need && `Cargo / request: ${need}`,
      "",
      message,
    ]
      .filter(Boolean)
      .join("\n");
    window.location.href = `mailto:${contact.quoteEmail}?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(body)}`;
  }

  const fieldClass =
    "w-full rounded-sm border border-stone-line bg-paper px-4 py-3 text-sm text-text placeholder:text-text-dim/60 outline-none transition-colors focus:border-navy";
  const labelClass = "text-xs font-semibold text-text-dim";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="name" className={labelClass}>
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
          <label htmlFor="company" className={labelClass}>
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
        <label htmlFor="service" className={labelClass}>
          Service
        </label>
        <select
          id="service"
          value={service}
          onChange={(e) => setService(e.target.value)}
          className={fieldClass}
        >
          <option value="">Select a service (optional)</option>
          {services.map((s) => (
            <option key={s.slug} value={s.name}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="need" className={labelClass}>
          What needs to move or be arranged
        </label>
        <input
          id="need"
          value={need}
          onChange={(e) => setNeed(e.target.value)}
          className={fieldClass}
          placeholder="e.g. 2 × 20ft containers, Dubai to Mogadishu"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="message" className={labelClass}>
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
      <p className="text-xs text-text-dim">
        Opens your email app, addressed to {contact.quoteEmail}.
      </p>
    </form>
  );
}
