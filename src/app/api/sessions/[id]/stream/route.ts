import { Role } from '@prisma/client';
import { handleApiError } from '@/lib/api-response';
import { requireRole } from '@/lib/server-auth';
import { getInstructorSessionSummary } from '@/modules/session/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireRole([Role.INSTRUCTOR, Role.TENANT_ADMIN, Role.SUPER_ADMIN]);
    const { id } = await context.params;

    const initial = await getInstructorSessionSummary(user, id);
    const encoder = new TextEncoder();

    let closed = false;
    let interval: ReturnType<typeof setInterval> | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const cleanup = () => {
      closed = true;
      if (interval) clearInterval(interval);
      if (timeoutId) clearTimeout(timeoutId);
    };

    const stream = new ReadableStream({
      start(controller) {
        let lastHash = '';

        const safeClose = () => {
          cleanup();
          try {
            controller.close();
          } catch {
            // already closed
          }
        };

        const sendEvent = (event: string, data: unknown) => {
          if (closed || request.signal.aborted) return;
          try {
            controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
          } catch {
            cleanup();
          }
        };

        const compactPayload = (summary: typeof initial) => ({
          status: summary.status,
          version: summary.version,
          permits: summary.permits,
          participants: summary.participants.map((p) => ({
            id: p.id,
            name: p.name,
            simulatedRole: p.simulatedRole,
            finalizedAt: p.finalizedAt,
            flagCount: p.flagCount,
            totalScore: p.totalScore,
          })),
          missedErrorsSummary: summary.missedErrorsSummary,
          updatedAt: summary.updatedAt,
        });

        const first = compactPayload(initial);
        lastHash = JSON.stringify({
          s: first.status,
          v: first.version,
          p: first.permits,
          u: first.participants,
        });
        sendEvent('summary', first);

        interval = setInterval(async () => {
          if (closed || request.signal.aborted) {
            safeClose();
            return;
          }
          try {
            const latest = compactPayload(await getInstructorSessionSummary(user, id));
            const nextHash = JSON.stringify({
              s: latest.status,
              v: latest.version,
              p: latest.permits,
              u: latest.participants,
            });
            if (nextHash !== lastHash) {
              lastHash = nextHash;
              sendEvent('summary', latest);
            } else {
              sendEvent('heartbeat', { ts: Date.now() });
            }
          } catch {
            safeClose();
          }
        }, 3500);

        timeoutId = setTimeout(() => {
          safeClose();
        }, 45_000);
      },
      cancel() {
        cleanup();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
