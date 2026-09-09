import type { Metadata } from "next";
import { brand, values } from "@/lib/content";
import { Container, Eyebrow, PrimaryLink } from "@/components/ui";

export const metadata: Metadata = {
  title: "About",
  description:
    "Portsimex Logistics' mission, vision, and values — connecting people, businesses, and communities through logistics.",
};

export default function AboutPage() {
  return (
    <>
      <section className="border-b border-ink-line">
        <Container className="py-16 sm:py-20">
          <Eyebrow>About Portsimex</Eyebrow>
          <h1 className="mt-3 max-w-2xl font-display text-4xl font-extrabold tracking-tight text-paper sm:text-5xl">
            {brand.promise}
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-paper-dim sm:text-lg">
            {brand.promiseCopy}
          </p>
        </Container>
      </section>

      <section className="border-b border-ink-line bg-ink-raised">
        <Container className="grid grid-cols-1 gap-10 py-16 sm:py-20 md:grid-cols-2">
          <div className="rounded-sm border border-ink-line bg-ink p-8">
            <span className="font-mono text-xs uppercase tracking-[0.25em] text-safety">
              Mission
            </span>
            <p className="mt-4 font-display text-xl font-bold leading-snug text-paper sm:text-2xl">
              {brand.mission}
            </p>
          </div>
          <div className="rounded-sm border border-ink-line bg-ink p-8">
            <span className="font-mono text-xs uppercase tracking-[0.25em] text-safety">
              Vision
            </span>
            <p className="mt-4 font-display text-xl font-bold leading-snug text-paper sm:text-2xl">
              {brand.vision}
            </p>
          </div>
        </Container>
      </section>

      <section className="border-b border-ink-line">
        <Container className="py-16 sm:py-20">
          <Eyebrow>Our values</Eyebrow>
          <h2 className="mt-3 max-w-2xl font-display text-3xl font-extrabold tracking-tight text-paper sm:text-4xl">
            What guides every shipment we handle
          </h2>
          <div className="mt-12 grid grid-cols-1 gap-10 sm:grid-cols-3">
            {values.map((value, i) => (
              <div key={value.name}>
                <span className="font-mono text-xs text-safety">
                  0{i + 1}
                </span>
                <h3 className="mt-2 font-display text-2xl font-bold text-paper">
                  {value.name}
                </h3>
                <ul className="mt-4 flex flex-col gap-3">
                  {value.points.map((point) => (
                    <li
                      key={point}
                      className="border-l-2 border-ink-line pl-4 text-sm leading-relaxed text-paper-dim"
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

      <section>
        <Container className="py-16 text-center sm:py-20">
          <h2 className="font-display text-2xl font-extrabold tracking-tight text-paper sm:text-3xl">
            Work with a team that shows up
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-paper-dim">
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
