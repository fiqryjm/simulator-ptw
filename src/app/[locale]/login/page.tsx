import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/server-auth';
import { getDashboardPathForRole } from '@/lib/rbac';
import { LoginForm } from '@/components/login-form';

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect(getDashboardPathForRole(user.role));
  }

  return (
    <main className="flex min-h-[calc(100vh-36px)] flex-col items-center justify-center px-4 py-12">
      <LoginForm />
      <nav aria-label="Language" className="mt-6 flex items-center gap-3 text-xs text-slate-600">
        <Link href="/login" className="underline hover:text-slate-900">
          Bahasa Indonesia
        </Link>
        <span aria-hidden="true">·</span>
        <Link href="/en/login" className="underline hover:text-slate-900">
          English
        </Link>
      </nav>
    </main>
  );
}
