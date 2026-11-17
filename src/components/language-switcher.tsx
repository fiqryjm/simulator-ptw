'use client';

import { useLocale } from 'next-intl';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

export function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname() || '/';

  const stripped = pathname.replace(/^\/en(?=\/|$)/, '') || '/';
  const idHref = stripped;
  const enHref = stripped === '/' ? '/en' : `/en${stripped}`;

  return (
    <nav aria-label="Language switcher" className="flex items-center gap-1.5 text-xs">
      <Link
        href={idHref}
        data-testid="lang-id"
        className={`rounded px-1.5 py-0.5 ${
          locale === 'id' ? 'bg-white text-[#0f2942] font-bold' : 'text-white/90 hover:underline'
        }`}
      >
        ID
      </Link>
      <span aria-hidden="true" className="text-white/60">
        |
      </span>
      <Link
        href={enHref}
        data-testid="lang-en"
        className={`rounded px-1.5 py-0.5 ${
          locale === 'en' ? 'bg-white text-[#0f2942] font-bold' : 'text-white/90 hover:underline'
        }`}
      >
        EN
      </Link>
    </nav>
  );
}
