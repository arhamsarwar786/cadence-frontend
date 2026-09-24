"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { notFound, useParams } from "next/navigation";
import { useState } from "react";
import {
  approveCreditNote,
  issueCreditNote,
  sendCreditNote,
  unapproveCreditNote,
  voidCreditNote,
} from "@/features/money/actions";
import { creditNoteKeys, getCreditNote } from "@/features/money/api";
import { isNotFound, messageFrom } from "@/shared/lib/errors";
import { formatMoney } from "@/shared/lib/money";
import { Button, Chip, PageHeader, PageFrame, PageScrollRegion } from "@/shared/ui";

export default function CreditNoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const query = useQuery({
    queryKey: creditNoteKeys.detail(id),
    queryFn: () => getCreditNote(id),
    retry: false,
  });

  if (query.isError && isNotFound(query.error)) notFound();
  if (query.isLoading) return <p className="text-sm text-cadence-ink/60">Loading…</p>;
  if (query.isError) return <p className="text-sm text-cadence-red">{messageFrom(query.error)}</p>;
  const note = query.data;
  if (!note) return null;

  async function act(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      await queryClient.invalidateQueries({ queryKey: creditNoteKeys.detail(id) });
    } catch (err) {
      setError(messageFrom(err));
    }
  }

  return (
    <PageFrame>
      <PageScrollRegion className="flex flex-col gap-6">
      <PageHeader
        title={note.credit_note_number}
        actions={
          <Chip tone={note.voided_at ? "danger" : "muted"}>
            {note.voided_at ? "Voided" : note.status}
          </Chip>
        }
      />
      <p className="text-sm text-cadence-ink/60">
        {note.client_name} · Invoice {note.invoice_number} · {note.reason}
      </p>
      <p className="font-heading text-3xl">
        {"total" in note ? formatMoney(note.total) : "—"}
      </p>
      {error ? <p className="text-sm text-cadence-red">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        {note.status === "draft" && !note.voided_at ? (
          <Button onClick={() => act(() => approveCreditNote(id))}>Approve</Button>
        ) : null}
        {note.status === "approved" && !note.voided_at ? (
          <>
            <Button variant="secondary" onClick={() => act(() => unapproveCreditNote(id))}>
              Unapprove
            </Button>
            <Button onClick={() => act(() => issueCreditNote(id))}>Issue</Button>
          </>
        ) : null}
        {note.status === "issued" && !note.voided_at ? (
          <Button onClick={() => act(() => sendCreditNote(id))}>Send</Button>
        ) : null}
        {!note.voided_at ? (
          <Button variant="danger" onClick={() => act(() => voidCreditNote(id))}>
            Void
          </Button>
        ) : null}
        <a href={`/api/v1/credit-notes/${id}/pdf/`} target="_blank" rel="noreferrer" className="underline text-sm self-center">
          PDF
        </a>
      </div>
      <ul className="divide-y divide-border rounded-lg border border-border">
        {(note.lines ?? []).map((line) => (
          <li key={line.id} className="flex justify-between px-4 py-3 text-sm">
            <span>{line.description}</span>
            <span>{"amount" in line ? formatMoney(line.amount) : "—"}</span>
          </li>
        ))}
      </ul>
    </PageScrollRegion>
    </PageFrame>
  );
}
