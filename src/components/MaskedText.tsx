import { useTranslations } from "next-intl";
import { HIDDEN_TOKEN } from "@/lib/constants";

// Replaces the database's "[contact hidden]" marker with a translated, highlighted note.
export function MaskedText({ text }: { text: string | null | undefined }) {
  const t = useTranslations("common");
  if (!text) return null;
  const parts = text.split(HIDDEN_TOKEN);
  return (
    <>
      {parts.map((part, i) => (
        <span key={i}>
          {part}
          {i < parts.length - 1 && (
            <span className="mx-0.5 rounded bg-gold-100 px-1 text-xs font-medium text-gold-600">{t("contactHidden")}</span>
          )}
        </span>
      ))}
    </>
  );
}
