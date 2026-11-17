import { PermitStatus } from '@prisma/client';
import {
  AlertCircle,
  Archive,
  CheckCircle2,
  Clock,
  FileEdit,
  PauseCircle,
  PlayCircle,
  RotateCcw,
  Send,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS_STYLE: Record<
  PermitStatus,
  { label: string; className: string; Icon: typeof FileEdit }
> = {
  DRAFT: {
    label: 'Draf',
    className: 'border-slate-300 bg-slate-100 text-slate-800',
    Icon: FileEdit,
  },
  SUBMITTED: {
    label: 'Diajukan',
    className: 'border-blue-300 bg-blue-100 text-blue-900',
    Icon: Send,
  },
  PENDING_ISSUANCE: {
    label: 'Menunggu Penerbitan',
    className: 'border-amber-300 bg-amber-100 text-amber-900',
    Icon: Clock,
  },
  APPROVED: {
    label: 'Disetujui',
    className: 'border-emerald-300 bg-emerald-100 text-emerald-900',
    Icon: CheckCircle2,
  },
  ACTIVE: {
    label: 'Aktif',
    className: 'border-green-400 bg-green-100 text-green-900',
    Icon: PlayCircle,
  },
  COMPLETED: {
    label: 'Selesai',
    className: 'border-teal-300 bg-teal-100 text-teal-900',
    Icon: CheckCircle2,
  },
  CLOSED: {
    label: 'Ditutup',
    className: 'border-slate-400 bg-slate-200 text-slate-900',
    Icon: Archive,
  },
  RETURNED: {
    label: 'Dikembalikan',
    className: 'border-orange-300 bg-orange-100 text-orange-900',
    Icon: RotateCcw,
  },
  REJECTED: {
    label: 'Ditolak',
    className: 'border-red-300 bg-red-100 text-red-900',
    Icon: XCircle,
  },
  SUSPENDED: {
    label: 'Ditangguhkan',
    className: 'border-yellow-400 bg-yellow-100 text-yellow-900',
    Icon: PauseCircle,
  },
  EXPIRED: {
    label: 'Kedaluwarsa',
    className: 'border-rose-300 bg-rose-100 text-rose-900',
    Icon: AlertCircle,
  },
};

export function PermitStatusBadge({
  status,
  labelOverride,
}: {
  status: PermitStatus;
  labelOverride?: string;
}) {
  const cfg = STATUS_STYLE[status];
  const Icon = cfg.Icon;

  return (
    <span
      data-testid="permit-status-badge"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        cfg.className,
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{labelOverride ?? cfg.label}</span>
    </span>
  );
}
