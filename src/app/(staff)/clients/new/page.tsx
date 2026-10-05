"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { clientKeys } from "@/features/clients/api";
import { ClientForm } from "@/features/clients/components/ClientForm";
import { createClient } from "@/features/clients/actions";
import type { ClientFormValues } from "@/features/clients/schemas";
import type { ClientWrite } from "@/features/clients/types";
import { PERM } from "@/permissions/keys";
import { EmptyState, PageFrame, PageHeader, PageScrollRegion, useHasPerm } from "@/shared/ui";

export default function NewClientPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  // Creating a client sets markup_pct, so the API wants clients.markup.edit too.
  const hasCreate = useHasPerm(PERM.CLIENTS_CREATE);
  const hasMarkupEdit = useHasPerm(PERM.CLIENTS_MARKUP_EDIT);
  const canCreate = hasCreate && hasMarkupEdit;

  async function handleSubmit(values: ClientFormValues) {
    // clientCreateSchema guarantees markup_pct is a non-empty string here.
    const client = await createClient({
      ...values,
      markup_pct: values.markup_pct as string,
      address_line_2: values.address_line_2 || undefined,
      billing_cycle: values.billing_cycle || undefined,
    } as ClientWrite);
    await queryClient.invalidateQueries({ queryKey: clientKeys.all });
    router.push(`/clients/${client.id}`);
  }

  return (
    <PageFrame>
      <PageHeader title="New client" />
      <PageScrollRegion className="flex flex-col gap-4">
        {canCreate ? (
          <ClientForm onSubmit={handleSubmit} submitLabel="Create client" requireMarkup />
        ) : (
          <EmptyState
            title="You can't create clients"
            description="Creating a client needs both the create-client and markup-edit permissions. Ask an administrator."
            className="items-start py-6 text-left"
          />
        )}
      </PageScrollRegion>
    </PageFrame>
  );
}
