"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { notFound, useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { archiveClient, updateClient, updateClientBilling } from "@/features/clients/actions";
import { clientKeys, getClient, getClientBilling } from "@/features/clients/api";
import { ClientBillingForm } from "@/features/clients/components/ClientBillingForm";
import { ClientContactsPanel } from "@/features/clients/components/ClientContactsPanel";
import { ClientForm } from "@/features/clients/components/ClientForm";
import { ClientStatusBadge } from "@/features/clients/components/ClientStatusBadge";
import type { ClientBillingFormValues, ClientFormValues } from "@/features/clients/schemas";
import { PROVINCE_LABELS } from "@/features/clients/schemas";
import type { ClientBillingWrite, ClientWrite } from "@/features/clients/types";
import { PERM } from "@/permissions/keys";
import { isNotFound, messageFrom } from "@/shared/lib/errors";
import type { ClientStatus } from "@/shared/lib/status-labels";
import { Button, PermGate, useConfirm } from "@/shared/ui";

const billingQueryKey = (clientId: string) => ["clients", clientId, "billing"] as const;

export default function ClientDetailPage() {
  const { id: clientId } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [editingClient, setEditingClient] = useState(false);
  const [editingBilling, setEditingBilling] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirm();

  const clientQuery = useQuery({
    queryKey: clientKeys.detail(clientId),
    queryFn: () => getClient(clientId),
    retry: false,
  });
  const billingQuery = useQuery({
    queryKey: billingQueryKey(clientId),
    queryFn: () => getClientBilling(clientId),
    retry: false,
  });

  if (clientQuery.isError && isNotFound(clientQuery.error)) {
    notFound();
  }

  async function handleUpdateClient(values: ClientFormValues) {
    await updateClient(clientId, {
      ...values,
      address_line_2: values.address_line_2 || undefined,
      markup_pct: values.markup_pct || undefined,
      billing_cycle: values.billing_cycle || undefined,
    } as Partial<ClientWrite>);
    await queryClient.invalidateQueries({ queryKey: clientKeys.detail(clientId) });
    await queryClient.invalidateQueries({ queryKey: clientKeys.all });
    setEditingClient(false);
  }

  async function handleUpdateBilling(values: ClientBillingFormValues) {
    await updateClientBilling(clientId, {
      ...values,
      billing_email: values.billing_email || undefined,
      tax_id: values.tax_id || undefined,
      payment_terms: values.payment_terms || undefined,
    } as ClientBillingWrite);
    await queryClient.invalidateQueries({ queryKey: billingQueryKey(clientId) });
    setEditingBilling(false);
  }

  async function handleArchive() {
    const ok = await confirm({
      title: "Archive this client?",
      body: "The client leaves the live list. Staff with edit access can reverse this with the office process.",
      confirmLabel: "Archive",
      danger: true,
    });
    if (!ok) return;
    await archiveClient(clientId);
    await queryClient.invalidateQueries({ queryKey: clientKeys.all });
    router.push("/clients");
  }

  if (clientQuery.isLoading) {
    return <p className="font-body text-sm text-cadence-ink/60">Loading…</p>;
  }
  if (clientQuery.isError) {
    return <p className="font-body text-sm text-cadence-red">{messageFrom(clientQuery.error)}</p>;
  }
  const client = clientQuery.data;
  if (!client) return null;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-heading text-3xl text-cadence-ink">{client.name}</h1>
          <div className="mt-1 flex items-center gap-2">
            <ClientStatusBadge status={client.status as ClientStatus} />
            <span className="font-body text-sm text-cadence-ink/60">
              {client.city}, {PROVINCE_LABELS[client.province]}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <PermGate anyOf={PERM.CLIENTS_EDIT}>
            <Button variant="secondary" onClick={() => setEditingClient((v) => !v)}>
              {editingClient ? "Cancel" : "Edit"}
            </Button>
          </PermGate>
          <PermGate anyOf={PERM.CLIENTS_DELETE}>
            <Button variant="danger" onClick={handleArchive}>
              Archive
            </Button>
          </PermGate>
        </div>
      </div>

      {editingClient ? (
        <ClientForm
          defaultValues={{
            name: client.name,
            status: client.status,
            address_line_1: client.address_line_1,
            address_line_2: client.address_line_2 ?? "",
            city: client.city,
            province: client.province,
            postal_code: client.postal_code,
            markup_pct: "markup_pct" in client ? client.markup_pct : undefined,
            billing_cycle: client.billing_cycle,
          }}
          onSubmit={handleUpdateClient}
          submitLabel="Save changes"
        />
      ) : (
        <dl className="grid max-w-xl grid-cols-2 gap-x-8 gap-y-3 font-body text-sm">
          <div className="col-span-2">
            <dt className="text-cadence-ink/60">Address</dt>
            <dd className="text-cadence-ink">
              {client.address_line_1}
              {client.address_line_2 ? `, ${client.address_line_2}` : ""}, {client.city},{" "}
              {client.province} {client.postal_code}
            </dd>
          </div>
          <div>
            <dt className="text-cadence-ink/60">Markup %</dt>
            <dd className="text-cadence-ink">
              {"markup_pct" in client ? `${client.markup_pct}%` : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-cadence-ink/60">Billing cycle</dt>
            <dd className="text-cadence-ink">{client.billing_cycle ?? "—"}</dd>
          </div>
        </dl>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-subheading text-xl text-cadence-ink">Billing</h2>
          {!editingBilling && billingQuery.data ? (
            <Button size="sm" variant="secondary" onClick={() => setEditingBilling(true)}>
              Edit
            </Button>
          ) : null}
        </div>
        {billingQuery.isLoading ? (
          <p className="font-body text-sm text-cadence-ink/60">Loading…</p>
        ) : billingQuery.isError && isNotFound(billingQuery.error) ? (
          // A client isn't seeded with a billing row (services.set_billing
          // is PUT create-or-replace) — the "not found" IS the "nothing
          // set up yet" state, not an error to surface.
          <ClientBillingForm defaultValues={{ payment_terms: "net_30" }} onSubmit={handleUpdateBilling} />
        ) : billingQuery.isError ? (
          <p className="font-body text-sm text-cadence-red">{messageFrom(billingQuery.error)}</p>
        ) : editingBilling && billingQuery.data ? (
          <ClientBillingForm
            defaultValues={{
              company_name: billingQuery.data.company_name,
              billing_email: billingQuery.data.billing_email ?? "",
              tax_id: billingQuery.data.tax_id ?? "",
              payment_terms: billingQuery.data.payment_terms,
              po_required: billingQuery.data.po_required,
            }}
            onSubmit={handleUpdateBilling}
          />
        ) : billingQuery.data ? (
          <dl className="grid max-w-xl grid-cols-2 gap-x-8 gap-y-3 font-body text-sm">
            <div>
              <dt className="text-cadence-ink/60">Company name</dt>
              <dd className="text-cadence-ink">{billingQuery.data.company_name}</dd>
            </div>
            <div>
              <dt className="text-cadence-ink/60">Billing email</dt>
              <dd className="text-cadence-ink">{billingQuery.data.billing_email || "—"}</dd>
            </div>
            <div>
              <dt className="text-cadence-ink/60">Payment terms</dt>
              <dd className="text-cadence-ink">{billingQuery.data.payment_terms ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-cadence-ink/60">PO required</dt>
              <dd className="text-cadence-ink">{billingQuery.data.po_required ? "Yes" : "No"}</dd>
            </div>
          </dl>
        ) : null}
      </section>

      <ClientContactsPanel clientId={clientId} />
      {confirmDialog}
    </div>
  );
}
