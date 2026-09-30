import type { Metadata } from "next";
import { contact, offices } from "@/lib/content";
import { Container, Eyebrow } from "@/components/ui";
import ContactForm from "./ContactForm";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Contact Portsimex Services in Mogadishu, Nairobi, Berbera, Garowe or Kismayo — request a quote for freight, clearance, transport, travel or vehicle rental.",
};

export default function ContactPage() {
  return (
    <>
      <section className="bg-ink text-paper">
        <Container className="py-16 sm:py-20">
          <Eyebrow tone="dark">Get in touch</Eyebrow>
          <h1 className="mt-3 max-w-xl font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
            Let&apos;s move your cargo
          </h1>
          <p className="mt-5 max-w-xl text-paper-dim">
            Talk to our operations team about your next shipment, clearance or
            project.
          </p>
        </Container>
      </section>

      <section>
        <Container className="grid grid-cols-1 gap-12 py-16 sm:py-20 lg:grid-cols-[1fr_1.3fr]">
          <div className="flex flex-col gap-9">
            <div>
              <Eyebrow>Phone</Eyebrow>
              <ul className="mt-3 flex flex-col gap-2">
                {contact.phones.map((phone) => (
                  <li key={phone.tel}>
                    <a
                      href={`tel:${phone.tel}`}
                      className="font-mono text-xl font-semibold text-ink hover:text-accent"
                    >
                      {phone.display}
                    </a>
                    <span className="ml-3 text-sm text-text-dim">{phone.label}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <Eyebrow>Email</Eyebrow>
              <ul className="mt-3 flex flex-col gap-3">
                {contact.emails.map((email) => (
                  <li key={email.address}>
                    <a
                      href={`mailto:${email.address}`}
                      className="font-display text-lg font-bold text-ink hover:text-accent"
                    >
                      {email.address}
                    </a>
                    <p className="text-sm text-text-dim">{email.label}</p>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <Eyebrow>Offices</Eyebrow>
              <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {offices.map((office) => (
                  <li key={office.city} className="rounded-md border border-stone-line bg-white px-4 py-3">
                    <p className="font-display font-bold text-ink">
                      {office.city}, {office.country}
                    </p>
                    <p className="text-xs text-text-dim">{office.role}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="h-fit rounded-md border border-stone-line bg-white p-6 shadow-sm sm:p-8">
            <h2 className="font-display text-xl font-bold text-ink">Request a quote</h2>
            <p className="mt-1 text-sm text-text-dim">
              Tell us what you need and we&apos;ll get back to you with a plan.
            </p>
            <div className="mt-6">
              <ContactForm />
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
