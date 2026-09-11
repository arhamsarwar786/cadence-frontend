"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { acceptOffer, declineOffer } from "@/features/portal/actions";
import { listShifts } from "@/features/portal/api";
import { messageFrom } from "@/shared/lib/errors";
import { Button } from "@/shared/ui";

const SHIFTS_KEY = ["portal", "shifts"] as const;

export default function OffersPage() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: SHIFTS_KEY, queryFn: listShifts });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  const offeredShifts = (query.data ?? []).filter((s) => s.offer_status === "offered");
  const byAssignment = new Map<string, typeof offeredShifts>();
  for (const shift of offeredShifts) {
    const list = byAssignment.get(shift.assignment_id) ?? [];
    list.push(shift);
    byAssignment.set(shift.assignment_id, list);
  }

  async function handleAccept(assignmentId: string) {
    setPending(assignmentId);
    setError(null);
    try {
      await acceptOffer(assignmentId);
      await queryClient.invalidateQueries({ queryKey: SHIFTS_KEY });
    } catch (err) {
      setError(messageFrom(err));
    } finally {
      setPending(null);
    }
  }

  async function handleDecline(assignmentId: string) {
    if (!window.confirm("Decline this offer?")) return;
    setPending(assignmentId);
    setError(null);
    try {
      await declineOffer(assignmentId);
      await queryClient.invalidateQueries({ queryKey: SHIFTS_KEY });
    } catch (err) {
      setError(messageFrom(err));
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-heading text-3xl text-cadence-ink">Offers</h1>
      {error ? <p className="font-body text-sm text-cadence-red">{error}</p> : null}

      {byAssignment.size > 0 ? (
        <ul className="flex flex-col gap-3">
          {Array.from(byAssignment.entries()).map(([assignmentId, shifts]) => (
            <li key={assignmentId} className="rounded-lg border border-border p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-body text-sm font-medium text-cadence-ink">
                    {shifts[0].job_title} — {shifts[0].client_name}
                  </p>
                  <p className="font-body text-xs text-cadence-ink/60">{shifts.length} shift(s)</p>
                  <ul className="mt-2 flex flex-col gap-0.5 font-body text-xs text-cadence-ink/70">
                    {shifts.map((s) => (
                      <li key={s.id}>
                        {s.shift_date} · {s.start_time}–{s.end_time}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={pending === assignmentId}
                    onClick={() => handleAccept(assignmentId)}
                  >
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={pending === assignmentId}
                    onClick={() => handleDecline(assignmentId)}
                  >
                    Decline
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="font-body text-sm text-cadence-ink/60">No pending offers.</p>
      )}
    </div>
  );
}
