import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/server-auth';
import { getDashboardPathForRole } from '@/lib/rbac';

export default async function DashboardIndexPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }
  redirect(getDashboardPathForRole(user.role));
}
