"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { creditNoteKeys } from "@/features/money/api";
import { CreditNoteForm } from "@/features/money/components/CreditNoteForm";
import { PERM } from "@/permissions/keys";
import { EmptyState, PageFrame, PageHeader, PageScrollRegion, useHasPerm, useToast } from "@/shared/ui";

export default function NewCreditNotePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const toast = useToast();
  // Drafting a credit note rides clients.invoice.edit (no credit_notes.* family exists).
  const canCreate = useHasPerm(PERM.CLIENTS_INVOICE_EDIT);
  const invoiceId = searchParams.get("invoice") ?? undefined;

  return (
    <PageFrame>
      <PageHeader title="New credit note" />
      <PageScrollRegion className="flex flex-col gap-4">
        {canCreate ? (
          <CreditNoteForm
            invoiceId={invoiceId}
            onCancel={() => router.push(invoiceId ? `/invoices/${invoiceId}` : "/credit-notes")}
            onCreated={async (note) => {
              await queryClient.invalidateQueries({ queryKey: creditNoteKeys.all });
              toast.success(`Credit note ${note.credit_note_number} saved as a draft.`);
              router.push(`/credit-notes/${note.id}`);
            }}
          />
        ) : (
          <EmptyState
            title="You can't create credit notes"
            description="Drafting a credit note needs the invoice-edit permission (clients.invoice.edit). Ask an administrator."
            className="items-start py-6 text-left"
          />
        )}
      </PageScrollRegion>
    </PageFrame>
  );
}
