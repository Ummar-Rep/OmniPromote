import type { Locale } from "@/i18n/routing";
import { setRequestLocale } from "next-intl/server";
import { LegalPage, type LegalSection } from "@/components/LegalPage";

const en: LegalSection[] = [
  {
    heading: "What we collect",
    body: "Company details, contact person, email, phone, website, event information, messages, and payment records.",
  },
  {
    heading: "How we use it",
    body: "To run the marketplace, verify companies, send notifications, issue invoices, prevent fraud and circumvention, and meet legal and tax duties in the UAE.",
  },
  {
    heading: "Who sees your contact details",
    body: "Your private contact details are only shown to the other side of a deal after the sponsor has paid, and to our team.",
  },
  {
    heading: "Storage and security",
    body: "Data is stored with our hosting providers (Supabase and Vercel) using encryption in transit. We keep records for as long as needed for legal and tax purposes.",
  },
  {
    heading: "Your rights",
    body: "You can ask us to access, correct or delete your personal data, subject to legal record-keeping duties, under the UAE Personal Data Protection Law.",
  },
];

const ar: LegalSection[] = [
  {
    heading: "ما الذي نجمعه",
    body: "بيانات الشركة، والشخص المسؤول، والبريد الإلكتروني، والهاتف، والموقع الإلكتروني، ومعلومات الفعاليات، والرسائل، وسجلات الدفع.",
  },
  {
    heading: "كيف نستخدمها",
    body: "لتشغيل السوق، والتحقق من الشركات، وإرسال الإشعارات، وإصدار الفواتير، ومنع الاحتيال والتحايل، والوفاء بالالتزامات القانونية والضريبية في الإمارات.",
  },
  {
    heading: "من يرى بيانات التواصل الخاصة بك",
    body: "لا تظهر بيانات التواصل الخاصة بك للطرف الآخر في الصفقة إلا بعد دفع الراعي، ولفريقنا.",
  },
  {
    heading: "التخزين والأمان",
    body: "تُخزن البيانات لدى مزودي الاستضافة (Supabase وVercel) مع تشفير أثناء النقل، ونحتفظ بالسجلات للمدة اللازمة لأغراض قانونية وضريبية.",
  },
  {
    heading: "حقوقك",
    body: "يمكنك طلب الوصول إلى بياناتك الشخصية أو تصحيحها أو حذفها، مع مراعاة التزامات حفظ السجلات، وفقًا لقانون حماية البيانات الشخصية في الإمارات.",
  },
];

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <LegalPage title={locale === "ar" ? "سياسة الخصوصية" : "Privacy Policy"} sections={locale === "ar" ? ar : en} />;
}
