"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import {
  createClientContact,
  deleteClientContact,
  updateClientContact,
} from "@/features/clients/actions";
import { listClientContacts } from "@/features/clients/api";
import { clientContactSchema, type ClientContactFormValues } from "@/features/clients/schemas";
import type { ClientContact } from "@/features/clients/types";
import { applyFieldErrors, messageFrom } from "@/shared/lib/errors";
import { Button, Dialog, Field, Input, useConfirm } from "@/shared/ui";

const contactsQueryKey = (clientId: string) => ["clients", clientId, "contacts"] as const;
const FIELD_NAMES = Object.keys(clientContactSchema.shape);

type DialogState = { mode: "create" } | { mode: "edit"; contact: ClientContact } | null;

function toFormValues(contact: ClientContact): ClientContactFormValues {
  return {
    name: contact.name,
    title: contact.title ?? "",
    email: contact.email ?? "",
    phone: contact.phone ?? "",
    is_primary: contact.is_primary,
    receives_job_notifications: contact.receives_job_notifications,
  };
}

function cleanContact(values: ClientContactFormValues) {
  return {
    ...values,
    title: values.title || undefined,
    email: values.email || undefined,
    phone: values.phone || undefined,
  };
}

function ContactForm({
  defaultValues,
  onSubmit,
  onCancel,
}: {
  defaultValues?: Partial<ClientContactFormValues>;
  onSubmit: (values: ClientContactFormValues) => Promise<void>;
  onCancel: () => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ClientContactFormValues>({
    resolver: zodResolver(clientContactSchema),
    defaultValues,
  });

  async function submit(values: ClientContactFormValues) {
    setFormError(null);
    try {
      await onSubmit(values);
    } catch (error) {
      const matched = applyFieldErrors(setError, error, FIELD_NAMES);
      if (!matched) setFormError(messageFrom(error));
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} noValidate className="flex flex-col gap-4">
      <Field label="Name" htmlFor="contact-name" error={errors.name?.message}>
        <Input id="contact-name" {...register("name")} />
      </Field>
      <Field label="Title" htmlFor="contact-title" error={errors.title?.message}>
        <Input id="contact-title" {...register("title")} />
      </Field>
      <Field label="Email" htmlFor="contact-email" error={errors.email?.message}>
        <Input id="contact-email" type="email" {...register("email")} />
      </Field>
      <Field label="Phone" htmlFor="contact-phone" error={errors.phone?.message}>
        <Input id="contact-phone" {...register("phone")} />
      </Field>
      <label className="flex items-center gap-2 font-body text-sm text-cadence-ink">
        <input type="checkbox" {...register("is_primary")} />
        Primary contact
      </label>
      <label className="flex items-center gap-2 font-body text-sm text-cadence-ink">
        <input type="checkbox" {...register("receives_job_notifications")} />
        Receives job notifications
      </label>
      {formError ? <p className="font-body text-sm text-cadence-red">{formError}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : "Save"}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function ClientContactsPanel({ clientId }: { clientId: string }) {
  const queryClient = useQueryClient();
  const queryKey = contactsQueryKey(clientId);
  const query = useQuery({ queryKey, queryFn: () => listClientContacts(clientId) });
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [dialogState, setDialogState] = useState<DialogState>(null);

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey });
  }

  async function handleCreate(values: ClientContactFormValues) {
    await createClientContact(clientId, cleanContact(values));
    await invalidate();
    setDialogState(null);
  }

  async function handleEdit(contactId: string, values: ClientContactFormValues) {
    await updateClientContact(clientId, contactId, cleanContact(values));
    await invalidate();
    setDialogState(null);
  }

  async function handleDelete(contactId: string) {
    const ok = await confirm({
      title: "Remove this contact?",
      body: "The contact will be deleted from this client.",
      confirmLabel: "Remove",
      danger: true,
    });
    if (!ok) return;
    await deleteClientContact(clientId, contactId);
    await invalidate();
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-subheading text-xl text-cadence-ink">Contacts</h2>
        <Button size="sm" onClick={() => setDialogState({ mode: "create" })}>
          Add contact
        </Button>
      </div>

      {query.isLoading ? (
        <p className="font-body text-sm text-cadence-ink/60">Loading…</p>
      ) : query.isError ? (
        <p className="font-body text-sm text-cadence-red">{messageFrom(query.error)}</p>
      ) : query.data && query.data.length > 0 ? (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {query.data.map((contact) => (
            <li key={contact.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="font-body text-sm font-medium text-cadence-ink">
                  {contact.name}
                  {contact.is_primary ? (
                    <span className="ml-2 text-xs text-cadence-orange">Primary</span>
                  ) : null}
                </p>
                <p className="font-body text-xs text-cadence-ink/60">
                  {[contact.title, contact.email, contact.phone].filter(Boolean).join(" · ")}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setDialogState({ mode: "edit", contact })}
                >
                  Edit
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handleDelete(contact.id)}>
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="font-body text-sm text-cadence-ink/60">No contacts yet.</p>
      )}

      <Dialog
        open={dialogState !== null}
        onClose={() => setDialogState(null)}
        title={dialogState?.mode === "edit" ? "Edit contact" : "Add contact"}
      >
        {dialogState ? (
          <ContactForm
            defaultValues={
              dialogState.mode === "edit" ? toFormValues(dialogState.contact) : undefined
            }
            onSubmit={(values) =>
              dialogState.mode === "edit"
                ? handleEdit(dialogState.contact.id, values)
                : handleCreate(values)
            }
            onCancel={() => setDialogState(null)}
          />
        ) : null}
      </Dialog>
      {confirmDialog}
    </section>
  );
}
