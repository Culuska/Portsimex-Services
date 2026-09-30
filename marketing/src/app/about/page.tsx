import type { Metadata } from "next";
import Image from "next/image";
import { about, brand, offices, values } from "@/lib/content";
import { Container, Eyebrow, NetworkMap, PrimaryLink } from "@/components/ui";
import teamHeavylift from "@/assets/images/team-heavylift.jpg";
import portCrane from "@/assets/images/port-crane-vessel.jpg";

export const metadata: Metadata = {
  title: "About",
  description:
    "Who we are: Portsimex Services Ltd, a Somali logistics and supply chain company headquartered in Mogadishu — our mission, vision, values and office network.",
};

export default function AboutPage() {
  return (
    <>
      <section className="bg-ink text-paper">
        <Container className="py-16 sm:py-20">
          <Eyebrow tone="dark">About us</Eyebrow>
          <h1 className="mt-3 max-w-3xl font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
            Logistics built for Somalia and the Horn of Africa
          </h1>
        </Container>
      </section>

      <section>
        <Container className="grid grid-cols-1 gap-12 py-16 sm:py-20 lg:grid-cols-[1.3fr_1fr]">
          <div className="flex flex-col gap-5">
            <Eyebrow>Who we are</Eyebrow>
            {about.map((paragraph) => (
              <p key={paragraph.slice(0, 32)} className="leading-relaxed text-text">
                {paragraph}
              </p>
            ))}
            <p className="leading-relaxed text-text">
              Our services include customs clearance, government tax exemption
              processing, transportation, warehousing, expedition and travel
              support, permit and visa processing, car and armoured vehicle
              rental, and life support services.
            </p>
          </div>
          <div className="flex flex-col gap-4">
            <Image
              src={portCrane}
              alt="Container vessel being worked by port cranes"
              sizes="(min-width: 1024px) 420px, 100vw"
              placeholder="blur"
              className="aspect-[16/10] w-full rounded-md object-cover shadow-md"
            />
            <Image
              src={teamHeavylift}
              alt="Portsimex Services supervisor directing a heavy-lift discharge at night"
              sizes="(min-width: 1024px) 420px, 100vw"
              placeholder="blur"
              className="aspect-[16/10] w-full rounded-md object-cover object-[50%_30%] shadow-md"
            />
          </div>
        </Container>
      </section>

      <section className="bg-stone">
        <Container className="grid grid-cols-1 gap-6 py-16 sm:py-20 md:grid-cols-2">
          {[
            { label: "Our mission", text: brand.mission },
            { label: "Our vision", text: brand.vision },
          ].map((item) => (
            <div key={item.label} className="rounded-md border-t-4 border-accent bg-white p-8 shadow-sm">
              <p className="font-mono text-xs uppercase tracking-[0.25em] text-accent">
                {item.label}
              </p>
              <p className="mt-4 font-display text-xl font-bold leading-snug text-ink sm:text-2xl">
                {item.text}
              </p>
            </div>
          ))}
        </Container>
      </section>

      <section>
        <Container className="py-16 sm:py-20">
          <Eyebrow>Our core values</Eyebrow>
          <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            How we work
          </h2>
          <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {values.map((value, i) => (
              <div key={value.name} className="border-l-2 border-gold pl-5">
                <span className="font-mono text-xs text-accent">0{i + 1}</span>
                <h3 className="mt-1 font-display text-xl font-bold text-ink">{value.name}</h3>
                <p className="mt-2 text-sm leading-relaxed text-text-dim">{value.text}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section className="bg-ink text-paper">
        <Container className="grid grid-cols-1 items-center gap-10 py-16 sm:py-20 lg:grid-cols-2">
          <div>
            <Eyebrow tone="dark">Our network</Eyebrow>
            <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
              Our offices and global links
            </h2>
            <p className="mt-4 text-paper-dim">
              From our head office in Mogadishu we operate across Somalia
              through our branches in Berbera, Garowe and Kismayo, with a
              regional office in Nairobi coordinating the wider Horn of Africa.
              Our freight partners connect every one of them to markets
              worldwide.
            </p>
            <ul className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {offices.map((office) => (
                <li key={office.city} className="rounded-md border border-ink-line px-4 py-3">
                  <p className="font-display font-bold">{office.city}, {office.country}</p>
                  <p className="text-xs text-paper-dim">{office.role}</p>
                </li>
              ))}
            </ul>
          </div>
          <NetworkMap className="mx-auto h-auto w-full max-w-lg" />
        </Container>
      </section>

      <section>
        <Container className="py-16 text-center sm:py-20">
          <h2 className="font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
            Work with a team that shows up
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-text-dim">
            Get in touch and bring your world closer.
          </p>
          <div className="mt-8">
            <PrimaryLink href="/contact">Request a quote</PrimaryLink>
          </div>
        </Container>
      </section>
    </>
  );
}
