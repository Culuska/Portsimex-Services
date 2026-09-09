import type { Metadata } from "next";
import { contact } from "@/lib/content";
import { Container, Eyebrow } from "@/components/ui";
import ContactForm from "./ContactForm";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Get in touch with Portsimex Logistics — request a quote or ask about air, sea, or land freight.",
};

export default function ContactPage() {
  return (
    <section>
      <Container className="py-16 sm:py-20">
        <Eyebrow>Get in touch</Eyebrow>
        <h1 className="mt-3 max-w-xl font-display text-4xl font-extrabold tracking-tight text-paper sm:text-5xl">
          Let&apos;s move your cargo
        </h1>

        <div className="mt-12 grid grid-cols-1 gap-12 lg:grid-cols-[1fr_1.3fr]">
          <div className="flex flex-col gap-8">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.25em] text-accent-light">
                Email
              </p>
              <a
                href={`mailto:${contact.email}`}
                className="mt-2 block font-display text-xl font-bold text-paper hover:text-accent-light"
              >
                {contact.email}
              </a>
            </div>
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.25em] text-accent-light">
                Phone
              </p>
              <div className="mt-2 flex flex-col gap-1">
                {contact.phones.map((phone) => (
                  <a
                    key={phone}
                    href={`tel:${phone}`}
                    className="font-mono text-lg text-paper hover:text-accent-light"
                  >
                    {phone}
                  </a>
                ))}
              </div>
            </div>
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.25em] text-accent-light">
                Based in
              </p>
              <p className="mt-2 text-lg text-paper">{contact.region}</p>
            </div>
          </div>

          <div className="rounded-sm border border-ink-line bg-ink-raised p-6 sm:p-8">
            <ContactForm />
          </div>
        </div>
      </Container>
    </section>
  );
}
