import type { Metadata } from "next";
import Image from "next/image";
import { services, type Service } from "@/lib/content";
import { Container, Eyebrow, PrimaryLink, ServiceIcon } from "@/components/ui";

export const metadata: Metadata = {
  title: "Services",
  description:
    "Freight forwarding, customs clearance and tax exemption, road transport, warehousing, humanitarian logistics, travel, permits and visas, and armoured vehicle rental from Portsimex Services.",
};

function ServiceSection({ service, index }: { service: Service; index: number }) {
  const flip = index % 2 === 1;
  return (
    <section
      id={service.slug}
      className={`scroll-mt-24 ${flip ? "bg-stone" : "bg-paper"}`}
    >
      <Container className="grid grid-cols-1 items-center gap-10 py-14 sm:py-16 lg:grid-cols-2 lg:gap-16">
        <div className={flip ? "lg:order-2" : ""}>
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-full border border-gold text-accent">
              <ServiceIcon name={service.icon} />
            </span>
            <span className="font-mono text-sm text-accent">
              Service {String(index + 1).padStart(2, "0")}
            </span>
          </div>
          <h2 className="mt-4 font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
            {service.name}
          </h2>
          <p className="mt-4 leading-relaxed text-text-dim">{service.body}</p>
          {service.points && (
            <ul className="mt-5 flex flex-col gap-2">
              {service.points.map((point) => (
                <li key={point} className="flex gap-3 text-sm leading-relaxed text-text">
                  <span aria-hidden className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-accent" />
                  {point}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={flip ? "lg:order-1" : ""}>
          {service.image ? (
            <Image
              src={service.image}
              alt={service.imageAlt ?? ""}
              sizes="(min-width: 1024px) 520px, 100vw"
              placeholder="blur"
              className="aspect-[16/10] w-full rounded-md object-cover shadow-md"
            />
          ) : (
            <div className="grid aspect-[16/10] w-full place-items-center rounded-md bg-gradient-to-br from-ink-raised to-ink shadow-md">
              <div className="flex flex-col items-center gap-4 text-center">
                <span className="grid h-24 w-24 place-items-center rounded-full border border-gold/70">
                  <ServiceIcon name={service.icon} className="h-12 w-12 text-gold-light" />
                </span>
                <span className="font-mono text-xs uppercase tracking-[0.25em] text-paper-dim">
                  {service.short}
                </span>
              </div>
            </div>
          )}
        </div>
      </Container>
    </section>
  );
}

export default function ServicesPage() {
  const freight = services.filter((s) => s.group === "freight");
  const beyond = services.filter((s) => s.group === "beyond");

  return (
    <>
      <section className="bg-ink text-paper">
        <Container className="py-16 sm:py-20">
          <Eyebrow tone="dark">What we do</Eyebrow>
          <h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
            Moving cargo in, clearing it through
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-paper-dim sm:text-lg">
            Freight forwarding, customs clearance and tax exemption, inland
            transport and warehousing — plus the travel, permits and vehicles
            that keep your people moving.
          </p>
          <nav aria-label="Services on this page" className="mt-8 flex flex-wrap gap-2">
            {services.map((s) => (
              <a
                key={s.slug}
                href={`#${s.slug}`}
                className="rounded-full border border-ink-line px-3.5 py-1.5 text-xs font-medium text-paper-dim transition-colors hover:border-gold hover:text-gold-light"
              >
                {s.name}
              </a>
            ))}
          </nav>
        </Container>
      </section>

      {freight.map((service, i) => (
        <ServiceSection key={service.slug} service={service} index={i} />
      ))}

      <section className="bg-ink text-paper">
        <Container className="py-12">
          <Eyebrow tone="dark">Beyond freight</Eyebrow>
          <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight">
            Travel, permits and mobility
          </h2>
          <p className="mt-3 max-w-2xl text-paper-dim">
            Alongside our freight and logistics work, we support the people
            behind every project: getting teams into the country, through the
            paperwork and on the road.
          </p>
        </Container>
      </section>

      {beyond.map((service, i) => (
        <ServiceSection key={service.slug} service={service} index={freight.length + i} />
      ))}

      <section className="border-t border-stone-line">
        <Container className="py-16 text-center sm:py-20">
          <h2 className="font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
            Need something you don&apos;t see here?
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-text-dim">
            Tell us what you need to move or arrange — most requests fall under
            something we already handle.
          </p>
          <div className="mt-8">
            <PrimaryLink href="/contact">Request a quote</PrimaryLink>
          </div>
        </Container>
      </section>
    </>
  );
}
