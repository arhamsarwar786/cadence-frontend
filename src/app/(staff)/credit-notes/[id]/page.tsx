"use client";

import { Loading } from "@/shared/ui/Loading";
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
import { PERM } from "@/permissions/keys";
import {
  Button,
  Chip,
  PageHeader,
  PageFrame,
  PageScrollRegion,
  PermGate,
  QueryError,
  useConfirm,
  useToast,
} from "@/shared/ui";

export default function CreditNoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirm();
  const toast = useToast();
  const query = useQuery({
    queryKey: creditNoteKeys.detail(id),
    queryFn: () => getCreditNote(id),
    retry: false,
  });

  if (query.isError && isNotFound(query.error)) notFound();
  if (query.isLoading) return <Loading />;
  if (query.isError) return <QueryError error={query.error} onRetry={() => query.refetch()} />;
  const note = query.data;
  if (!note) return null;

  async function act(fn: () => Promise<unknown>, successMessage?: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await fn();
      await queryClient.invalidateQueries({ queryKey: creditNoteKeys.detail(id) });
      if (successMessage) toast.success(successMessage);
    } catch (err) {
      setError(messageFrom(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleVoid() {
    const ok = await confirm({
      title: "Void this credit note?",
      body: "A voided credit note no longer offsets the invoice. This cannot be undone from this screen.",
      confirmLabel: "Void credit note",
      danger: true,
    });
    if (ok) await act(() => voidCreditNote(id));
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
          <PermGate anyOf={PERM.CLIENTS_INVOICE_APPROVE}>
            <Button disabled={busy} onClick={() => act(() => approveCreditNote(id))}>
              Approve
            </Button>
          </PermGate>
        ) : null}
        {note.status === "approved" && !note.voided_at ? (
          <>
            <PermGate anyOf={PERM.CLIENTS_INVOICE_APPROVE}>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => act(() => unapproveCreditNote(id))}
              >
                Unapprove
              </Button>
            </PermGate>
            <PermGate anyOf={PERM.INVOICES_SEND}>
              <Button disabled={busy} onClick={() => act(() => issueCreditNote(id))}>
                Issue
              </Button>
            </PermGate>
          </>
        ) : null}
        {note.status === "issued" && !note.voided_at ? (
          <PermGate anyOf={PERM.INVOICES_SEND}>
            <Button
              disabled={busy}
              onClick={() => act(() => sendCreditNote(id), "Credit note sent.")}
            >
              Send
            </Button>
          </PermGate>
        ) : null}
        {!note.voided_at ? (
          <PermGate anyOf={[PERM.CLIENTS_INVOICE_EDIT, PERM.INVOICES_SEND]}>
            <Button variant="danger" disabled={busy} onClick={handleVoid}>
              Void
            </Button>
          </PermGate>
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
      {confirmDialog}
    </PageScrollRegion>
    </PageFrame>
  );
}
