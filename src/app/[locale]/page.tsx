import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/server-auth';
import { getDashboardPathForRole } from '@/lib/rbac';

export default async function HomePage() {
  const user = await getCurrentUser();
  if (user) {
    redirect(getDashboardPathForRole(user.role));
  }
  redirect('/login');
}
