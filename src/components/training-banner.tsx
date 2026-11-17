import { AlertTriangle } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

export async function TrainingBanner() {
  const t = await getTranslations('app');

  return (
    <div
      role="banner"
      aria-label={t('trainingBanner')}
      className="flex w-full items-center justify-center gap-2 bg-[#ea580c] px-4 py-2 text-center text-xs font-bold tracking-wide text-white uppercase sm:text-sm"
    >
      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{t('trainingBanner')}</span>
    </div>
  );
}
