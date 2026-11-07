import type { Locale } from "@/i18n/routing";
import { setRequestLocale } from "next-intl/server";
import { LegalPage, type LegalSection } from "@/components/LegalPage";

const en: LegalSection[] = [
  {
    heading: "About OmniPromote",
    body: "OmniPromote is an online marketplace operated by OmniPromote FZE (United Arab Emirates) that introduces event organizers to sponsors. We are not a party to the event itself.",
  },
  {
    heading: "Accounts",
    body: "You must provide accurate company information and keep your login secure. We may verify, suspend or remove accounts that break these terms.",
  },
  {
    heading: "Listings and proposals",
    body: "Organizers are responsible for the accuracy of their events and packages and must deliver the benefits they list. Sponsors are responsible for the content they ask to be displayed.",
  },
  {
    heading: "Payments and commission",
    body: "Sponsors pay the full agreed amount, plus VAT where applicable, to OmniPromote against our invoice. After the event and approval of proof of delivery, OmniPromote pays the organizer the agreed amount minus the platform commission shown on the deal. The commission rate is shown before a proposal is accepted.",
  },
  {
    heading: "Communication on the platform",
    body: "Until a sponsor has paid for a deal, all communication must take place on OmniPromote. Phone numbers, emails, links and social media handles are hidden automatically, and repeated attempts to share them may lead to suspension.",
  },
  {
    heading: "Non-circumvention",
    body: "For 24 months after OmniPromote introduces an organizer and a sponsor to each other, neither party may enter into any sponsorship, advertising or similar agreement with the other outside the platform. If they do, the organizer must pay OmniPromote the commission it would have earned on that agreement, and OmniPromote may also suspend both accounts.",
  },
  {
    heading: "Proof of delivery and disputes",
    body: "Organizers upload proof that the sponsorship benefits were delivered. Sponsors have 7 days to approve or raise a concern with our team. If no concern is raised, the proof is treated as approved.",
  },
  {
    heading: "Cancellations and refunds",
    body: "If an event is cancelled by the organizer, the sponsor receives a full refund of amounts paid to OmniPromote. Other cancellations are handled case by case.",
  },
  {
    heading: "Liability",
    body: "OmniPromote is not responsible for the conduct of organizers or sponsors or for the outcome of events. Our total liability is limited to the commission we earned on the deal in question.",
  },
  {
    heading: "Governing law",
    body: "These terms are governed by the laws of the United Arab Emirates. Disputes will be resolved by the competent courts of Dubai.",
  },
];

const ar: LegalSection[] = [
  {
    heading: "عن أومني بروموت",
    body: "أومني بروموت سوق إلكتروني تديره شركة أومني بروموت م.م.ح (الإمارات العربية المتحدة) يعرّف منظمي الفعاليات بالرعاة. لسنا طرفًا في الفعالية نفسها.",
  },
  {
    heading: "الحسابات",
    body: "يجب تقديم معلومات صحيحة عن الشركة والحفاظ على أمان بيانات الدخول. يحق لنا التحقق من الحسابات أو تعليقها أو حذفها عند مخالفة هذه الشروط.",
  },
  {
    heading: "الإعلانات والعروض",
    body: "المنظمون مسؤولون عن دقة فعالياتهم وباقاتهم وعليهم تقديم المزايا المعلنة. والرعاة مسؤولون عن المحتوى الذي يطلبون عرضه.",
  },
  {
    heading: "المدفوعات والعمولة",
    body: "يدفع الراعي كامل المبلغ المتفق عليه مع ضريبة القيمة المضافة عند انطباقها إلى أومني بروموت بموجب فاتورتنا. وبعد الفعالية والموافقة على إثبات التنفيذ، تدفع أومني بروموت للمنظم المبلغ المتفق عليه مخصومًا منه عمولة المنصة الموضحة في الصفقة.",
  },
  {
    heading: "التواصل عبر المنصة",
    body: "حتى يدفع الراعي قيمة الصفقة، يجب أن يتم كل التواصل عبر أومني بروموت. يتم إخفاء أرقام الهاتف والبريد الإلكتروني والروابط وحسابات التواصل الاجتماعي تلقائيًا، وقد تؤدي المحاولات المتكررة لمشاركتها إلى تعليق الحساب.",
  },
  {
    heading: "عدم التحايل",
    body: "لمدة ٢٤ شهرًا بعد أن تعرّف أومني بروموت منظمًا براعٍ، لا يجوز لأي منهما إبرام أي اتفاقية رعاية أو إعلان أو ما شابه مع الآخر خارج المنصة. وفي حال حدوث ذلك، يلتزم المنظم بدفع العمولة التي كانت ستستحقها أومني بروموت، ويحق لأومني بروموت تعليق الحسابين.",
  },
  {
    heading: "إثبات التنفيذ والنزاعات",
    body: "يرفع المنظم إثباتًا على تقديم مزايا الرعاية، وللراعي ٧ أيام للموافقة أو رفع ملاحظة إلى فريقنا. إذا لم تُرفع أي ملاحظة، يُعتبر الإثبات موافقًا عليه.",
  },
  {
    heading: "الإلغاء والاسترداد",
    body: "إذا ألغى المنظم الفعالية، يسترد الراعي كامل المبالغ المدفوعة إلى أومني بروموت. وتُعالج حالات الإلغاء الأخرى كلٌّ على حدة.",
  },
  {
    heading: "المسؤولية",
    body: "أومني بروموت غير مسؤولة عن تصرفات المنظمين أو الرعاة أو عن نتائج الفعاليات. وتقتصر مسؤوليتنا الإجمالية على العمولة التي حصلنا عليها من الصفقة المعنية.",
  },
  {
    heading: "القانون الواجب التطبيق",
    body: "تخضع هذه الشروط لقوانين دولة الإمارات العربية المتحدة، وتختص محاكم دبي بالفصل في النزاعات.",
  },
];

export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <LegalPage title={locale === "ar" ? "شروط الخدمة" : "Terms of Service"} sections={locale === "ar" ? ar : en} />;
}
