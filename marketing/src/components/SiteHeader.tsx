"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { contact } from "@/lib/content";

const links = [
  { href: "/services", label: "Services" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export default function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-ink-line/80 bg-ink/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
        <Link
          href="/"
          className="flex items-center gap-2.5"
          onClick={() => setOpen(false)}
        >
          <span
            aria-hidden
            className="grid h-8 w-8 place-items-center rounded-sm bg-accent font-display text-base font-black text-paper"
          >
            P
          </span>
          <span className="font-display text-lg font-extrabold tracking-tight text-paper">
            PORTSIMEX
            <span className="ml-1.5 hidden text-paper-dim font-sans text-xs font-medium tracking-[0.2em] uppercase sm:inline">
              Logistics
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm font-medium tracking-wide transition-colors ${
                pathname === link.href
                  ? "text-accent-light"
                  : "text-paper-dim hover:text-paper"
              }`}
            >
              {link.label}
            </Link>
          ))}
          <a
            href={`tel:${contact.phones[0]}`}
            className="rounded-sm bg-accent px-4 py-2 text-sm font-semibold text-paper transition-colors hover:bg-accent-strong"
          >
            {contact.phones[0]}
          </a>
        </nav>

        <button
          type="button"
          className="grid h-9 w-9 place-items-center rounded-sm border border-ink-line text-paper md:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="font-display text-lg leading-none">
            {open ? "×" : "="}
          </span>
        </button>
      </div>

      {open && (
        <nav className="border-t border-ink-line bg-ink px-5 py-4 md:hidden">
          <ul className="flex flex-col gap-1">
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className={`block rounded-sm px-3 py-2.5 text-base font-medium ${
                    pathname === link.href
                      ? "bg-ink-raised text-accent-light"
                      : "text-paper-dim"
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <a
            href={`tel:${contact.phones[0]}`}
            className="mt-3 block rounded-sm bg-accent px-4 py-2.5 text-center text-sm font-semibold text-paper"
          >
            Call {contact.phones[0]}
          </a>
        </nav>
      )}
    </header>
  );
}
