import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'wouter';
import { ArrowLeft, ArrowUpRight, CheckCircle2, Clock3, FileText, GraduationCap } from 'lucide-react';
import { Navbar } from '@/components/navbar';
import { SEO } from '@/components/seo';
import { BIHAR_TECHNICAL_EDUCATION_PATH, departmentRegisterUrl, equipmentRecords, evidenceCheckedOn } from '@/data/bihar-technical-education';

export default function BiharTechnicalEducation() {
  const { i18n } = useTranslation();
  const hi = i18n.language.startsWith('hi');
  const [filter, setFilter] = useState<'all' | 'engineering' | 'polytechnic'>('all');
  const text = (en: string, hindi: string) => hi ? hindi : en;
  const money = (value: number) => new Intl.NumberFormat(hi ? 'hi-IN' : 'en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
  const date = (value: string) => new Intl.DateTimeFormat(hi ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(value + 'T00:00:00Z'));
  const records = equipmentRecords.filter(record => filter === 'all' || record.category === filter);
  return <div className="min-h-screen bg-background text-foreground">
    <SEO title={text('Bihar Technical Education — Evidence Tracker', 'बिहार तकनीकी शिक्षा — प्रमाण ट्रैकर')} description={text('Department-level equipment sanctions with original documents and explicit expenditure verification status.', 'विभागीय उपकरण स्वीकृतियाँ, मूल दस्तावेज़ और व्यय सत्यापन की स्थिति।')} path={BIHAR_TECHNICAL_EDUCATION_PATH} />
    <Navbar />
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <Link href="/state-facts" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"><ArrowLeft size={16} />{text('State data / Bihar', 'राज्य डेटा / बिहार')}</Link>
      <header className="mt-8 max-w-3xl">
        <p className="font-mono text-xs uppercase tracking-widest text-primary">{text('Department evidence • Bihar', 'विभागीय प्रमाण • बिहार')}</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">{text('Technical education.', 'तकनीकी शिक्षा।')}</h1>
        <p className="mt-3 text-lg text-muted-foreground">{text('Follow the documents. Understand what is verified.', 'दस्तावेज़ देखें। जानें कि किस बात की पुष्टि हुई है।')}</p>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{text('Science, Technology and Technical Education Department, Government of Bihar. Department-wide equipment funding for FY 2026–27.', 'विज्ञान, प्रावैधिकी एवं तकनीकी शिक्षा विभाग, बिहार सरकार। वित्तीय वर्ष 2026–27 में विभाग के संस्थानों के उपकरणों का वित्तपोषण।')}</p>
        <p className="mt-4 font-mono text-xs text-muted-foreground">{text('Evidence checked', 'प्रमाण जाँचे गए')}: <time dateTime={evidenceCheckedOn}>{date(evidenceCheckedOn)}</time></p>
      </header>

      <aside className="my-8 rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 text-sm leading-relaxed" aria-label={text('Evidence limitations', 'प्रमाण की सीमाएँ')}>
        <strong className="block mb-1">{text('Sanction documented. Outcomes still to be verified.', 'स्वीकृति का दस्तावेज़ उपलब्ध है। परिणामों की पुष्टि बाकी है।')}</strong>
        {text('An amount stated as released in an order is not independent proof of treasury payment, spending or installation. Records not located in our public-source search remain pending; they do not mean zero expenditure or failure. No performance score is assigned.', 'आदेश में राशि विमुक्त लिखी होना treasury payment, वास्तविक खर्च या installation का स्वतंत्र प्रमाण नहीं है। Public-source search में record नहीं मिलने का अर्थ शून्य खर्च या विफलता नहीं है। कोई performance score नहीं दिया गया है।')}
      </aside>

      <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label={text('Filter institution type', 'संस्थान प्रकार चुनें')}>
        {(['all', 'engineering', 'polytechnic'] as const).map(value => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${filter === value ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:bg-muted'}`}>
          {value === 'all' ? text('All records', 'सभी रिकॉर्ड') : value === 'engineering' ? text('Engineering', 'अभियंत्रण') : text('Polytechnic', 'पॉलिटेक्निक')}
        </button>)}
      </div>
      <p className="sr-only" role="status">{text(`${records.length} records shown`, `${records.length} रिकॉर्ड दिखाए गए`)}</p>

      <div className="grid gap-6 lg:grid-cols-2">
        {records.map(record => <article key={record.order} className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="border-b border-border p-6">
            <div className="flex items-start justify-between gap-3"><GraduationCap className="text-primary" aria-hidden="true" /><span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-800 dark:text-emerald-300">{text('Signed order inspected', 'हस्ताक्षरित आदेश जाँचा गया')}</span></div>
            <h2 className="mt-4 text-xl font-bold">{record.category === 'engineering' ? text('Engineering college equipment', 'अभियंत्रण महाविद्यालयों के उपकरण') : text('Polytechnic equipment', 'पॉलिटेक्निक के उपकरण')}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{text(`${record.institutions} institutions`, `${record.institutions} संस्थान`)} · {text('Order', 'आदेश')} {record.order} · <time dateTime={record.orderDate}>{date(record.orderDate)}</time></p>
          </div>
          <div className="p-6">
            <dl className="grid gap-5 sm:grid-cols-2">
              <div><dt className="text-xs text-muted-foreground">{text('Administrative approval', 'प्रशासनिक स्वीकृति')}</dt><dd className="mt-2 break-words text-2xl font-bold tabular-nums">{money(record.approvedRupees)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">{text('First instalment stated in order', 'आदेश में दर्ज प्रथम किस्त')}</dt><dd className="mt-2 break-words text-2xl font-bold tabular-nums">{money(record.firstInstalmentRupees)}</dd></div>
            </dl>
            <h3 className="mb-3 mt-7 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{text('Evidence status', 'प्रमाण की स्थिति')}</h3>
            <ul className="space-y-3 text-sm">
              <li className="flex gap-3"><CheckCircle2 size={18} className="shrink-0 text-emerald-700 dark:text-emerald-400" /><span>{text('Sanction and distribution table inspected', 'स्वीकृति और वितरण तालिका जाँची गई')}</span></li>
              {[text('Treasury payment', 'कोषागार भुगतान'), text('Actual expenditure', 'वास्तविक खर्च'), text('Delivery and installation', 'आपूर्ति और अधिष्ठापन')].map(label => <li key={label} className="flex gap-3"><Clock3 size={18} className="shrink-0 text-amber-700 dark:text-amber-400" /><span>{label}<span className="block text-xs text-muted-foreground">{text('Verification pending — record not located in search', 'सत्यापन बाकी — खोज में रिकॉर्ड नहीं मिला')}</span></span></li>)}
            </ul>
            <a href={record.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-7 flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-3 text-sm font-semibold hover:border-primary hover:text-primary"><span className="flex items-center gap-2"><FileText size={16} />{text(`Original order ${record.order} · PDF, 4 pages`, `मूल आदेश ${record.order} · PDF, 4 पृष्ठ`)}</span><ArrowUpRight size={16} /></a>
            <details className="mt-4 text-sm"><summary className="cursor-pointer font-medium hover:text-primary">{text('Source notes and conditions', 'स्रोत विवरण और शर्तें')}</summary><div className="mt-3 space-y-3 leading-relaxed text-muted-foreground">
              <p>{text('Distribution and totals: pages 1–3. Procurement conditions: page 3, paragraphs 4–8. Dispatch number and signature: page 4. Table sums match the printed totals.', 'वितरण और कुल राशि: पृष्ठ 1–3। खरीद की शर्तें: पृष्ठ 3, अनुच्छेद 4–8। पत्र संख्या और हस्ताक्षर: पृष्ठ 4। तालिकाओं का योग मुद्रित कुल राशि से मेल खाता है।')}</p>
              <p>{text('The orders require GeM procurement with a stated rule-based alternative, principal responsibility for quality, and equipment lists and installation reports. Compliance is not yet independently verified.', 'आदेश में GeM से खरीद तथा नियमों के अनुसार विकल्प, गुणवत्ता के लिए प्राचार्य की जिम्मेदारी और उपकरण सूची व अधिष्ठापन प्रतिवेदन की शर्तें हैं। अनुपालन की स्वतंत्र पुष्टि बाकी है।')}</p>
              <p className="break-all font-mono text-xs">{text('Budget bill code', 'विपत्र कोड')}: {record.billCode}</p>
            </div></details>
          </div>
        </article>)}
      </div>
      <section className="mt-10 rounded-xl border border-border p-6">
        <h2 className="text-lg font-bold">{text('What would verify the next stage?', 'अगले चरण की पुष्टि कैसे होगी?')}</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{text('Dated expenditure statements, treasury payment records, delivery/stock records and installation reports received by the department. This tracker covers department-level evidence; it does not rate individual colleges.', 'तारीख सहित व्यय विवरणी, कोषागार भुगतान रिकॉर्ड, आपूर्ति/स्टॉक रिकॉर्ड और विभाग को प्राप्त अधिष्ठापन प्रतिवेदन। यह ट्रैकर विभागीय प्रमाण दिखाता है; अलग-अलग कॉलेजों को rating नहीं देता।')}</p>
        <a className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary underline underline-offset-4" href={departmentRegisterUrl} target="_blank" rel="noopener noreferrer">{text('Department sanction register', 'विभागीय स्वीकृत्यादेश रजिस्टर')}<ArrowUpRight size={14} /></a>
      </section>
    </main>
  </div>;
}
