import Link from "next/link";
import { brand, contact, services, values } from "@/lib/content";
import { Container, Eyebrow, PrimaryLink, RoutePattern, SecondaryLink } from "@/components/ui";

export default function Home() {
  const featured = services.filter((s) => !s.draft);
  const rest = services.filter((s) => s.draft);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-ink-line">
        <RoutePattern className="pointer-events-none absolute inset-0 h-full w-full text-ink-line" />
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 right-0 h-96 w-96 rounded-full bg-accent/20 blur-[120px]"
        />
        <Container className="relative py-20 sm:py-28">
          <Eyebrow>Freight forwarding · Somalia &amp; the Horn of Africa</Eyebrow>
          <h1 className="mt-5 max-w-3xl font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-paper sm:text-6xl">
            {brand.tagline}
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-paper-dim sm:text-lg">
            {brand.name} moves cargo by air, sea, and land — freight
            forwarding, customs clearance, and door-to-door logistics for
            businesses trading in and out of Somalia.
          </p>
          <div className="mt-9 flex flex-wrap gap-4">
            <PrimaryLink href="/contact">Request a quote</PrimaryLink>
            <SecondaryLink href="/services">View services</SecondaryLink>
          </div>

          <div className="mt-16 grid grid-cols-1 gap-6 border-t border-ink-line pt-8 sm:grid-cols-3">
            <div>
              <p className="font-display text-lg font-bold text-paper">Air</p>
              <p className="mt-1 text-sm text-paper-dim">
                Time-sensitive and high-value cargo, moved fast.
              </p>
            </div>
            <div>
              <p className="font-display text-lg font-bold text-paper">Sea</p>
              <p className="mt-1 text-sm text-paper-dim">
                FCL, LCL, NVOCC, and OOG ocean freight.
              </p>
            </div>
            <div>
              <p className="font-display text-lg font-bold text-paper">Land</p>
              <p className="mt-1 text-sm text-paper-dim">
                Port-to-door trucking and inland haulage.
              </p>
            </div>
          </div>
        </Container>
      </section>

      {/* Services */}
      <section className="border-b border-ink-line bg-ink-raised">
        <Container className="py-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <Eyebrow>What we do</Eyebrow>
              <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-paper sm:text-4xl">
                Our Services
              </h2>
            </div>
            <Link
              href="/services"
              className="text-sm font-semibold text-accent hover:text-accent-light"
            >
              All services →
            </Link>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2">
            {featured.map((service) => (
              <Link
                key={service.slug}
                href={`/services#${service.slug}`}
                className="group rounded-sm border border-ink-line bg-ink p-6 transition-colors hover:border-accent"
              >
                <h3 className="font-display text-lg font-bold text-paper">
                  {service.name}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-paper-dim">
                  {service.short}
                </p>
                <span className="mt-4 inline-block text-sm font-semibold text-accent group-hover:text-accent-light">
                  Learn more →
                </span>
              </Link>
            ))}
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((service) => (
              <Link
                key={service.slug}
                href={`/services#${service.slug}`}
                className="rounded-sm border border-ink-line px-5 py-4 text-sm font-medium text-paper-dim transition-colors hover:border-paper-dim hover:text-paper"
              >
                {service.name}
              </Link>
            ))}
          </div>
        </Container>
      </section>

      {/* Values */}
      <section className="border-b border-ink-line">
        <Container className="py-20">
          <Eyebrow>Our values</Eyebrow>
          <h2 className="mt-3 max-w-2xl font-display text-3xl font-extrabold tracking-tight text-paper sm:text-4xl">
            How we work, on every shipment
          </h2>
          <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-3">
            {values.map((value, i) => (
              <div key={value.name}>
                <span className="font-mono text-xs text-accent-light">
                  0{i + 1}
                </span>
                <h3 className="mt-2 font-display text-xl font-bold text-paper">
                  {value.name}
                </h3>
                <ul className="mt-3 flex flex-col gap-2">
                  {value.points.map((point) => (
                    <li
                      key={point}
                      className="text-sm leading-relaxed text-paper-dim"
                    >
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* Brand promise */}
      <section className="border-b border-ink-line bg-ink-raised">
        <Container className="py-20">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_1.4fr] lg:items-center">
            <div>
              <Eyebrow>Our brand promise</Eyebrow>
              <p className="mt-3 font-display text-3xl font-extrabold tracking-tight text-paper sm:text-4xl">
                {brand.promise}
              </p>
            </div>
            <p className="text-base leading-relaxed text-paper-dim sm:text-lg">
              {brand.promiseCopy}
            </p>
          </div>
        </Container>
      </section>

      {/* CTA */}
      <section>
        <Container className="py-20">
          <div className="rounded-sm border border-ink-line bg-ink-raised px-6 py-12 sm:px-12">
            <div className="flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-display text-2xl font-extrabold tracking-tight text-paper sm:text-3xl">
                  Moving cargo? Let&apos;s talk.
                </h2>
                <p className="mt-2 max-w-md text-sm text-paper-dim">
                  Tell us what you need to move and where — we&apos;ll get
                  back to you with a plan.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:items-end">
                <a
                  href={`mailto:${contact.email}`}
                  className="text-sm font-semibold text-paper hover:text-accent-light"
                >
                  {contact.email}
                </a>
                <a
                  href={`tel:${contact.phones[0]}`}
                  className="font-mono text-sm text-paper-dim hover:text-paper"
                >
                  {contact.phones[0]}
                </a>
                <PrimaryLink href="/contact">Request a quote</PrimaryLink>
              </div>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
