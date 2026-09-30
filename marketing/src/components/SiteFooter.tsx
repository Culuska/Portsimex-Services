import Link from "next/link";
import { brand, contact, offices, services } from "@/lib/content";
import { LogoBadge } from "@/components/ui";

export default function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-ink text-paper">
      <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1fr_1fr]">
          <div>
            <LogoBadge />
            <p className="mt-6 max-w-xs text-sm leading-relaxed text-paper-dim">
              {brand.summary}
            </p>
          </div>

          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-gold-light">
              Services
            </p>
            <ul className="mt-4 flex flex-col gap-2.5">
              {services.map((service) => (
                <li key={service.slug}>
                  <Link
                    href={`/services#${service.slug}`}
                    className="text-sm text-paper-dim transition-colors hover:text-paper"
                  >
                    {service.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-gold-light">
              Offices
            </p>
            <ul className="mt-4 flex flex-col gap-2.5">
              {offices.map((office) => (
                <li key={office.city} className="text-sm text-paper-dim">
                  <span className="text-paper">{office.city}</span>
                  <span className="block text-xs">{office.role}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-gold-light">
              Talk to us
            </p>
            <ul className="mt-4 flex flex-col gap-2.5 text-sm">
              {contact.emails.map((email) => (
                <li key={email.address}>
                  <a
                    href={`mailto:${email.address}`}
                    className="text-paper-dim transition-colors hover:text-paper"
                  >
                    {email.address}
                  </a>
                </li>
              ))}
              {contact.phones.map((phone) => (
                <li key={phone.tel}>
                  <a
                    href={`tel:${phone.tel}`}
                    className="font-mono text-paper-dim transition-colors hover:text-paper"
                  >
                    {phone.display}
                  </a>
                  <span className="ml-2 text-xs text-paper-dim/70">{phone.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-ink-line pt-6 text-xs text-paper-dim sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {brand.legalName}. All rights reserved.
          </p>
          <p className="text-gold-light">{brand.tagline}</p>
        </div>
      </div>
    </footer>
  );
}
