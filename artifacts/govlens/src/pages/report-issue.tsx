import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { SEO } from '@/components/seo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { AlertCircle, CheckCircle2, Flag, Loader2 } from 'lucide-react';

// ── Issue type enum (mirrors server) ─────────────────────────────────────────
const ISSUE_TYPES = [
  'data_error',
  'broken_link',
  'missing_data',
  'ui_bug',
  'inappropriate',
  'other',
] as const;

// i18n key suffix per type
const ISSUE_TYPE_KEYS: Record<string, string> = {
  data_error:    'reportIssueTypeDataError',
  broken_link:   'reportIssueTypeBrokenLink',
  missing_data:  'reportIssueTypeMissingData',
  ui_bug:        'reportIssueTypeUiBug',
  inappropriate: 'reportIssueTypeInappropriate',
  other:         'reportIssueTypeOther',
};

// ── Client-side validation schema ─────────────────────────────────────────────
const formSchema = z.object({
  issueType:    z.enum(ISSUE_TYPES, { required_error: 'Please select an issue type' }),
  pageAffected: z.string().max(500).optional().or(z.literal('')),
  description:  z.string().min(10, 'Please describe the issue in at least 10 characters').max(2000),
  email:        z.string().email('Please enter a valid email address').max(254).optional().or(z.literal('')),
  honeypot:     z.string().max(0).optional(), // must stay empty
});

type FormValues = z.infer<typeof formSchema>;

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ReportIssue() {
  const { t } = useTranslation();

  const [submitState, setSubmitState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      issueType:    undefined,
      pageAffected: '',
      description:  '',
      email:        '',
      honeypot:     '',
    },
  });

  async function onSubmit(values: FormValues) {
    setSubmitState('loading');
    setErrorMsg('');

    try {
      const res = await fetch('/api/report-issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      if (res.status === 201) {
        setSubmitState('success');
        form.reset();
        return;
      }

      const data = await res.json().catch(() => ({}));

      if (res.status === 429) {
        setErrorMsg(t('reportIssueErrorRateLimit'));
      } else {
        setErrorMsg(data?.error || t('reportIssueErrorGeneric'));
      }
      setSubmitState('error');
    } catch {
      setErrorMsg(t('reportIssueErrorNetwork'));
      setSubmitState('error');
    }
  }

  const descLen = form.watch('description')?.length ?? 0;

  return (
    <div className="min-h-[100dvh] bg-background">
      <SEO
        title={t('reportIssueSeoTitle')}
        description={t('reportIssueSeoDesc')}
        path="/report-issue"
      />

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Flag className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {t('reportIssueTitle')}
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {t('reportIssueSubtitle')}
            </p>
          </div>
        </div>

        {/* ── Success state ── */}
        {submitState === 'success' ? (
          <div className="rounded-xl border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900 p-8 text-center">
            <CheckCircle2 className="w-12 h-12 text-green-600 dark:text-green-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">
              {t('reportIssueSuccessTitle')}
            </h2>
            <p className="text-muted-foreground text-sm mb-6">
              {t('reportIssueSuccessText')}
            </p>
            <Button variant="outline" onClick={() => setSubmitState('idle')}>
              {t('reportIssueSubmitAnother')}
            </Button>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card p-6 sm:p-8">

            {/* ── Error banner ── */}
            {submitState === 'error' && errorMsg && (
              <div className="mb-6 flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
                <AlertCircle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                <p className="text-sm text-destructive">{errorMsg}</p>
              </div>
            )}

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-6">

                {/* Honeypot — hidden from real users; bots fill it in */}
                <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', overflow: 'hidden' }}>
                  <input
                    tabIndex={-1}
                    autoComplete="off"
                    {...form.register('honeypot')}
                    type="text"
                  />
                </div>

                {/* Issue type */}
                <FormField
                  control={form.control}
                  name="issueType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t('reportIssueTypeLabel')}
                        <span className="text-destructive ml-1">*</span>
                      </FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('reportIssueTypePlaceholder')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ISSUE_TYPES.map((type) => (
                            <SelectItem key={type} value={type}>
                              {t(ISSUE_TYPE_KEYS[type])}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Page affected */}
                <FormField
                  control={form.control}
                  name="pageAffected"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('reportIssuePageLabel')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('reportIssuePagePlaceholder')}
                          maxLength={500}
                          autoComplete="off"
                          spellCheck={false}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>{t('reportIssuePageDesc')}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Description */}
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t('reportIssueDescLabel')}
                        <span className="text-destructive ml-1">*</span>
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={t('reportIssueDescPlaceholder')}
                          maxLength={2000}
                          rows={5}
                          className="resize-none"
                          {...field}
                        />
                      </FormControl>
                      <div className="flex justify-between items-start">
                        <FormMessage />
                        <span className={`text-xs ml-auto pl-2 ${descLen > 1900 ? 'text-destructive' : 'text-muted-foreground'}`}>
                          {descLen}/2000
                        </span>
                      </div>
                    </FormItem>
                  )}
                />

                {/* Email */}
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('reportIssueEmailLabel')}</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder={t('reportIssueEmailPlaceholder')}
                          maxLength={254}
                          autoComplete="email"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>{t('reportIssueEmailDesc')}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Privacy note */}
                <p className="text-xs text-muted-foreground/70 leading-relaxed">
                  {t('reportIssuePrivacyNote')}
                </p>

                {/* Submit */}
                <Button
                  type="submit"
                  disabled={submitState === 'loading'}
                  className="w-full sm:w-auto"
                >
                  {submitState === 'loading' ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {t('reportIssueSubmitting')}
                    </>
                  ) : (
                    t('reportIssueSubmitBtn')
                  )}
                </Button>
              </form>
            </Form>
          </div>
        )}
      </div>
    </div>
  );
}
