import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { TrainingBanner } from '@/components/training-banner';
import '../globals.css';

export const metadata: Metadata = {
  title: 'Simulator Permit to Work (PTW)',
  description: 'Alat pelatihan Permit to Work (PTW) untuk Oil & Gas, Pembangkit Listrik, dan Pertambangan.',
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <NextIntlClientProvider messages={messages}>
          <TrainingBanner />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
