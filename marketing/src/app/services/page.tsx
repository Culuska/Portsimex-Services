import type { Metadata } from "next";
import { services } from "@/lib/content";
import { Container, Eyebrow, PrimaryLink } from "@/components/ui";

export const metadata: Metadata = {
  title: "Services",
  description:
    "Air, sea, and land freight forwarding, customs clearance, warehousing, and logistics services from Portsimex Logistics.",
};

export default function ServicesPage() {
  return (
    <>
      <section className="border-b border-ink-line">
        <Container className="py-16 sm:py-20">
          <Eyebrow>What we provide</Eyebrow>
          <h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight text-paper sm:text-5xl">
            Our Services
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-paper-dim sm:text-lg">
            One partner across the full move — air, sea, and land freight,
            customs clearance, warehousing, and everything in between.
          </p>
        </Container>
      </section>

      <div className="divide-y divide-ink-line">
        {services.map((service, i) => (
          <section
            key={service.slug}
            id={service.slug}
            className="scroll-mt-20 odd:bg-ink even:bg-ink-raised"
          >
            <Container className="py-14 sm:py-16">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-[auto_1fr] lg:gap-12">
                <span className="font-mono text-sm text-safety">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="max-w-2xl">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="font-display text-2xl font-bold text-paper sm:text-3xl">
                      {service.name}
                    </h2>
                    {service.draft && (
                      <span className="rounded-full border border-ink-line px-2.5 py-0.5 text-xs font-medium text-paper-dim">
                        Details coming soon
                      </span>
                    )}
                  </div>
                  <p className="mt-3 text-base leading-relaxed text-paper-dim">
                    {service.short}
                  </p>
                  {service.body?.map((paragraph) => (
                    <p
                      key={paragraph.slice(0, 24)}
                      className="mt-4 text-sm leading-relaxed text-paper-dim"
                    >
                      {paragraph}
                    </p>
                  ))}
                </div>
              </div>
            </Container>
          </section>
        ))}
      </div>

      <section className="border-t border-ink-line">
        <Container className="py-16 text-center sm:py-20">
          <h2 className="font-display text-2xl font-extrabold tracking-tight text-paper sm:text-3xl">
            Need something you don&apos;t see here?
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-paper-dim">
            Tell us what you&apos;re moving — most freight and logistics needs
            fall under something we already handle.
          </p>
          <div className="mt-8">
            <PrimaryLink href="/contact">Request a quote</PrimaryLink>
          </div>
        </Container>
      </section>
    </>
  );
}
