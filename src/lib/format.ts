export function formatAed(value: number | null | undefined, locale: string) {
  if (value === null || value === undefined) return "";
  return new Intl.NumberFormat(locale === "ar" ? "ar-AE" : "en-AE", {
    style: "currency",
    currency: "AED",
    maximumFractionDigits: 0,
  }).format(Number(value));
}

export function formatNumber(value: number | null | undefined, locale: string) {
  if (value === null || value === undefined) return "";
  return new Intl.NumberFormat(locale === "ar" ? "ar-AE" : "en-AE").format(Number(value));
}

export function formatDate(value: string | null | undefined, locale: string) {
  if (!value) return "";
  const d = value.length === 10 ? new Date(value + "T00:00:00") : new Date(value);
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-AE" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function formatDateTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-AE" : "en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function pick(row: object, field: string, locale: string): string {
  const r = row as Record<string, unknown>;
  const ar = r[`${field}_ar`];
  const en = r[`${field}_en`];
  if (locale === "ar" && typeof ar === "string" && ar.trim()) return ar;
  return typeof en === "string" ? en : "";
}
