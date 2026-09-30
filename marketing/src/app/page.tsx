import Image from "next/image";
import Link from "next/link";
import { brand, contact, offices, reasons, services } from "@/lib/content";
import {
  Container,
  Eyebrow,
  NetworkMap,
  PrimaryLink,
  SecondaryLink,
  ServiceIcon,
} from "@/components/ui";
import teamHeavylift from "@/assets/images/team-heavylift.jpg";
import teamInspection from "@/assets/images/team-inspection.jpg";

const stats = [
  { value: "5", label: "Offices across Somalia & Kenya" },
  { value: "8", label: "Services under one roof" },
  { value: "24/7", label: "Operations support" },
  { value: "All", label: "Ports in Somalia served" },
];

export default function Home() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-ink text-paper">
        <div
          aria-hidden
          className="pointer-events-none absolute -left-40 -top-40 h-[28rem] w-[28rem] rounded-full bg-navy/40 blur-[140px]"
        />
        <Container className="relative grid grid-cols-1 items-center gap-10 py-16 sm:py-20 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <Eyebrow tone="dark">Logistics · Customs · Travel</Eyebrow>
            <h1 className="mt-5 font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
              {brand.tagline}
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-paper-dim sm:text-lg">
              {brand.legalName} moves cargo by air, sea and road, clears it
              through customs and delivers it anywhere in Somalia — from our
              head office in Mogadishu, branches in Berbera, Garowe and
              Kismayo, and our regional office in Nairobi.
            </p>
            <div className="mt-9 flex flex-wrap gap-4">
              <PrimaryLink href="/contact">Request a quote</PrimaryLink>
              <SecondaryLink href="/services">Our services</SecondaryLink>
            </div>
          </div>
          <NetworkMap className="mx-auto h-auto w-full max-w-xl" />
        </Container>

        <div className="relative border-t border-ink-line bg-ink-raised/60">
          <Container className="grid grid-cols-2 gap-6 py-8 lg:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label}>
                <p className="font-display text-3xl font-extrabold text-gold-light">
                  {stat.value}
                </p>
                <p className="mt-1 text-sm text-paper-dim">{stat.label}</p>
              </div>
            ))}
          </Container>
        </div>
      </section>

      {/* Services */}
      <section>
        <Container className="py-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <Eyebrow>What we do</Eyebrow>
              <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
                Our services
              </h2>
            </div>
            <Link
              href="/services"
              className="text-sm font-semibold text-accent hover:text-accent-strong"
            >
              All services →
            </Link>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {services.map((service) => (
              <Link
                key={service.slug}
                href={`/services#${service.slug}`}
                className="group flex flex-col overflow-hidden rounded-md border border-stone-line bg-white transition-shadow hover:shadow-lg"
              >
                <div className="relative aspect-[16/10] overflow-hidden bg-ink">
                  {service.image ? (
                    <Image
                      src={service.image}
                      alt={service.imageAlt ?? ""}
                      fill
                      sizes="(min-width: 1024px) 270px, (min-width: 640px) 50vw, 100vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="grid h-full place-items-center bg-gradient-to-br from-ink-raised to-ink">
                      <ServiceIcon name={service.icon} className="h-14 w-14 text-gold-light" />
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <span className="grid h-9 w-9 place-items-center rounded-full border border-gold text-accent">
                    <ServiceIcon name={service.icon} className="h-5 w-5" />
                  </span>
                  <h3 className="mt-3 font-display text-lg font-bold leading-snug text-ink">
                    {service.name}
                  </h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-text-dim">
                    {service.short}
                  </p>
                  <span className="mt-4 text-sm font-semibold text-accent group-hover:text-accent-strong">
                    Learn more →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </Container>
      </section>

      {/* Why choose us */}
      <section className="bg-ink text-paper">
        <Container className="py-20">
          <Eyebrow tone="dark">Why Portsimex Services</Eyebrow>
          <h2 className="mt-3 max-w-2xl font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
            A diversified, trusted logistics partner
          </h2>
          <p className="mt-4 max-w-2xl text-paper-dim">
            From a single air shipment to a full project cargo operation,
            clients choose us for dependable delivery in an environment where
            local knowledge matters.
          </p>
          <div className="mt-12 grid grid-cols-1 gap-px overflow-hidden rounded-md border border-ink-line bg-ink-line sm:grid-cols-2 lg:grid-cols-3">
            {reasons.map((reason) => (
              <div key={reason.title} className="bg-ink p-7">
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-gold-light">
                  {reason.label}
                </p>
                <h3 className="mt-2 font-display text-xl font-bold">{reason.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-paper-dim">{reason.text}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* Team in the field */}
      <section className="bg-stone">
        <Container className="grid grid-cols-1 items-center gap-12 py-20 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <Eyebrow>Our team in the field</Eyebrow>
            <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
              On the ground, at every step
            </h2>
            <p className="mt-5 leading-relaxed text-text-dim">
              Our own people supervise discharge at the port, inspect every
              truck before it heads inland and stay with the cargo until it
              is delivered. That is what makes one accountable team from
              origin to final destination possible.
            </p>
            <div className="mt-8">
              <SecondaryLink href="/about" tone="light">
                About Portsimex Services
              </SecondaryLink>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { img: teamHeavylift, caption: "Supervising a night-time heavy-lift discharge at the port" },
              { img: teamInspection, caption: "Inspecting a container truck before dispatch inland" },
            ].map(({ img, caption }, i) => (
              <figure key={caption} className={i === 1 ? "mt-10" : ""}>
                <Image
                  src={img}
                  alt={caption}
                  sizes="(min-width: 1024px) 320px, 50vw"
                  placeholder="blur"
                  className="aspect-[3/4] w-full rounded-md object-cover shadow-md"
                />
                <figcaption className="mt-2 text-xs leading-snug text-text-dim">
                  {caption}
                </figcaption>
              </figure>
            ))}
          </div>
        </Container>
      </section>

      {/* Offices */}
      <section>
        <Container className="py-20">
          <Eyebrow>Our network</Eyebrow>
          <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            Where we operate
          </h2>
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {offices.map((office, i) => (
              <div
                key={office.city}
                className={`rounded-md border p-5 ${
                  i === 0 ? "border-accent bg-accent text-paper" : "border-stone-line bg-white"
                }`}
              >
                <p className={`font-mono text-[11px] uppercase tracking-[0.18em] ${i === 0 ? "text-accent-light" : "text-accent"}`}>
                  {office.role}
                </p>
                <p className={`mt-2 font-display text-xl font-bold ${i === 0 ? "" : "text-ink"}`}>
                  {office.city}
                </p>
                <p className={`text-sm ${i === 0 ? "text-paper/80" : "text-text-dim"}`}>{office.country}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* CTA */}
      <section className="pb-20">
        <Container>
          <div className="rounded-md bg-ink px-6 py-12 text-paper sm:px-12">
            <div className="flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
                  Moving cargo? Let&apos;s talk.
                </h2>
                <p className="mt-2 max-w-md text-sm text-paper-dim">
                  Talk to our operations team about your next shipment,
                  clearance or project.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:items-end">
                <a
                  href={`mailto:${contact.quoteEmail}`}
                  className="text-sm font-semibold hover:text-gold-light"
                >
                  {contact.quoteEmail}
                </a>
                {contact.phones.map((phone) => (
                  <a
                    key={phone.tel}
                    href={`tel:${phone.tel}`}
                    className="font-mono text-sm text-paper-dim hover:text-paper"
                  >
                    {phone.display} · {phone.label}
                  </a>
                ))}
                <PrimaryLink href="/contact">Request a quote</PrimaryLink>
              </div>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
