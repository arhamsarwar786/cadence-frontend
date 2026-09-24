"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { clientKeys } from "@/features/clients/api";
import { ClientForm } from "@/features/clients/components/ClientForm";
import { createClient } from "@/features/clients/actions";
import type { ClientFormValues } from "@/features/clients/schemas";
import type { ClientWrite } from "@/features/clients/types";
import { PageFrame, PageScrollRegion } from "@/shared/ui";

export default function NewClientPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

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
      <PageScrollRegion className="flex flex-col gap-4">
        <h1 className="font-heading text-3xl text-cadence-ink">New client</h1>
        <ClientForm onSubmit={handleSubmit} submitLabel="Create client" requireMarkup />
      </PageScrollRegion>
    </PageFrame>
  );
}
