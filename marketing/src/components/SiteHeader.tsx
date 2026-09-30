"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { contact } from "@/lib/content";
import { Logo } from "@/components/ui";

const links = [
  { href: "/services", label: "Services" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export default function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const phone = contact.phones[0];

  return (
    <header className="sticky top-0 z-50 border-b border-stone-line bg-paper/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3 sm:px-8">
        <Link
          href="/"
          aria-label="Portsimex Services — home"
          onClick={() => setOpen(false)}
        >
          <Logo />
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm font-semibold tracking-wide transition-colors ${
                pathname === link.href
                  ? "text-accent"
                  : "text-navy hover:text-accent"
              }`}
            >
              {link.label}
            </Link>
          ))}
          <a
            href={`tel:${phone.tel}`}
            className="rounded-sm bg-ink px-4 py-2 font-mono text-sm font-semibold text-paper transition-colors hover:bg-navy"
          >
            {phone.display}
          </a>
        </nav>

        <button
          type="button"
          className="grid h-10 w-10 place-items-center rounded-sm border border-stone-line text-navy md:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </div>

      {open && (
        <nav className="border-t border-stone-line bg-paper px-5 py-4 md:hidden">
          <ul className="flex flex-col gap-1">
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className={`block rounded-sm px-3 py-2.5 text-base font-semibold ${
                    pathname === link.href ? "bg-stone text-accent" : "text-navy"
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <a
            href={`tel:${phone.tel}`}
            className="mt-3 block rounded-sm bg-ink px-4 py-2.5 text-center text-sm font-semibold text-paper"
          >
            Call {phone.display}
          </a>
        </nav>
      )}
    </header>
  );
}
