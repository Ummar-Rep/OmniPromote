import { useTranslations } from "next-intl";
import { Notice } from "./ui";

export type LegalSection = { heading: string; body: string };

export function LegalPage({ title, sections }: { title: string; sections: LegalSection[] }) {
  const t = useTranslations("legal");
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="mb-4 text-3xl font-bold">{title}</h1>
      <Notice>{t("draftNote")}</Notice>
      <div className="mt-8 space-y-6">
        {sections.map((s, i) => (
          <section key={i}>
            <h2 className="mb-2 text-lg font-semibold">
              {i + 1}. {s.heading}
            </h2>
            <p className="whitespace-pre-line leading-relaxed text-navy-700">{s.body}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
