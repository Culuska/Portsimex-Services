import Link from "next/link";
import { brand, contact, services } from "@/lib/content";

export default function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-ink-line bg-ink-raised">
      <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="font-display text-lg font-extrabold tracking-tight text-paper">
              PORTSIMEX
            </p>
            <p className="mt-1 text-sm text-paper-dim">{brand.tagline}</p>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-paper-dim">
              {brand.promise} — freight forwarding and logistics across
              Somalia and the Horn of Africa.
            </p>
          </div>

          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-paper-dim">
              Services
            </p>
            <ul className="mt-4 flex flex-col gap-2.5">
              {services.slice(0, 5).map((service) => (
                <li key={service.slug}>
                  <Link
                    href={`/services#${service.slug}`}
                    className="text-sm text-paper-dim transition-colors hover:text-paper"
                  >
                    {service.name}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/services"
                  className="text-sm font-medium text-accent transition-colors hover:text-safety"
                >
                  View all services →
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-paper-dim">
              Company
            </p>
            <ul className="mt-4 flex flex-col gap-2.5">
              <li>
                <Link
                  href="/about"
                  className="text-sm text-paper-dim transition-colors hover:text-paper"
                >
                  Mission &amp; values
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="text-sm text-paper-dim transition-colors hover:text-paper"
                >
                  Get a quote
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-paper-dim">
              Talk to us
            </p>
            <ul className="mt-4 flex flex-col gap-2.5 text-sm">
              <li>
                <a
                  href={`mailto:${contact.email}`}
                  className="text-paper-dim transition-colors hover:text-paper"
                >
                  {contact.email}
                </a>
              </li>
              {contact.phones.map((phone) => (
                <li key={phone}>
                  <a
                    href={`tel:${phone}`}
                    className="font-mono text-paper-dim transition-colors hover:text-paper"
                  >
                    {phone}
                  </a>
                </li>
              ))}
              <li className="text-paper-dim">{contact.region}</li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-ink-line pt-6 text-xs text-paper-dim sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {brand.name}. All rights reserved.
          </p>
          <p>{brand.mission}</p>
        </div>
      </div>
    </footer>
  );
}
