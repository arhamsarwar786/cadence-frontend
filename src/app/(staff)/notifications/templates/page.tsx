"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { createTemplate, deleteTemplate, listTemplates, updateTemplate } from "@/features/notifications/api";
import type { NotificationTemplate } from "@/features/notifications/types";
import { applyFieldErrors, messageFrom } from "@/shared/lib/errors";
import { NOTIFICATION_TYPE_LABELS, type NotificationType } from "@/shared/lib/status-labels";
import { PERM } from "@/permissions/keys";
import { Button, Dialog, Field, Input, ListSkeleton, PermGate, Select, useConfirm } from "@/shared/ui";

const templateSchema = z
  .object({
    type: z.enum(["shift_offer", "esign", "cert_expiry", "task", "invoice"]),
    channel: z.enum(["email", "in_app", "sms"]),
    subject: z.string().optional().or(z.literal("")),
    body: z.string().min(1, "Body is required."),
  })
  .superRefine((values, ctx) => {
    if (values.channel === "email" && !values.subject?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["subject"],
        message: "Email templates need a subject.",
      });
    }
  });
type TemplateFormValues = z.infer<typeof templateSchema>;
const FIELD_NAMES = ["type", "channel", "subject", "body"] as const;
const QUERY_KEY = ["notification-templates"] as const;

export default function NotificationTemplatesPage() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: QUERY_KEY, queryFn: listTemplates });
  const [dialogState, setDialogState] = useState<null | { mode: "create" } | { mode: "edit"; tpl: NotificationTemplate }>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const { confirm, dialog: confirmDialog } = useConfirm();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<TemplateFormValues>({
    resolver: zodResolver(templateSchema),
    defaultValues: { channel: "email", subject: "", body: "" },
  });

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: QUERY_KEY });
  }

  async function submit(values: TemplateFormValues) {
    setFormError(null);
    try {
      const body = { ...values, subject: values.subject || undefined };
      if (dialogState?.mode === "edit") {
        await updateTemplate(dialogState.tpl.id, body);
      } else {
        await createTemplate(body);
      }
      await invalidate();
      reset();
      setDialogState(null);
    } catch (error) {
      const formMessage = applyFieldErrors(setError, error, FIELD_NAMES);
      if (formMessage) setFormError(formMessage);
    }
  }

  async function handleDelete(id: string) {
    const ok = await confirm({
      title: "Delete this template?",
      body: "The office will no longer be able to send this notification type from this template.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    await deleteTemplate(id);
    await invalidate();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-3xl text-cadence-ink">Notification templates</h1>
        <PermGate anyOf={PERM.NOTIFICATIONS_TEMPLATES_MANAGE}>
          <Button onClick={() => setDialogState({ mode: "create" })}>New template</Button>
        </PermGate>
      </div>

      {query.isLoading ? (
        <ListSkeleton />
      ) : query.data && query.data.length > 0 ? (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {query.data.map((tpl) => (
            <li key={tpl.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="font-body text-sm font-medium text-cadence-ink">
                  {NOTIFICATION_TYPE_LABELS[tpl.type as NotificationType]}
                </p>
                <p className="font-body text-xs text-cadence-ink/60">{tpl.subject || "No subject"}</p>
              </div>
              <div className="flex gap-2">
                <PermGate anyOf={PERM.NOTIFICATIONS_TEMPLATES_MANAGE}>
                  <Button size="sm" variant="secondary" onClick={() => setDialogState({ mode: "edit", tpl })}>
                    Edit
                  </Button>
                </PermGate>
                <PermGate anyOf={PERM.NOTIFICATIONS_TEMPLATES_MANAGE}>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(tpl.id)}>
                    Delete
                  </Button>
                </PermGate>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="font-body text-sm text-cadence-ink/60">No templates yet.</p>
      )}

      <Dialog
        open={dialogState !== null}
        onClose={() => setDialogState(null)}
        title={dialogState?.mode === "edit" ? "Edit template" : "New template"}
      >
        <form onSubmit={handleSubmit(submit)} noValidate className="flex flex-col gap-4">
          <Field label="Type" htmlFor="tpl-type" error={errors.type?.message}>
            <Select id="tpl-type" defaultValue={dialogState?.mode === "edit" ? dialogState.tpl.type : undefined} {...register("type")}>
              <option value="shift_offer">Shift offer</option>
              <option value="esign">E-sign</option>
              <option value="cert_expiry">Certification expiry</option>
              <option value="task">Task</option>
              <option value="invoice">Invoice</option>
            </Select>
          </Field>
          <Field label="Channel" htmlFor="tpl-channel" error={errors.channel?.message}>
            <Select id="tpl-channel" defaultValue={dialogState?.mode === "edit" ? dialogState.tpl.channel : undefined} {...register("channel")}>
              <option value="email">Email</option>
              <option value="in_app">In-app</option>
              <option value="sms">SMS</option>
            </Select>
          </Field>
          <Field label="Subject" htmlFor="tpl-subject" error={errors.subject?.message}>
            <Input id="tpl-subject" defaultValue={dialogState?.mode === "edit" ? (dialogState.tpl.subject ?? "") : ""} {...register("subject")} />
          </Field>
          <Field label="Body" htmlFor="tpl-body" error={errors.body?.message}>
            <textarea
              id="tpl-body"
              rows={5}
              defaultValue={dialogState?.mode === "edit" ? dialogState.tpl.body : ""}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm font-body text-cadence-ink"
              {...register("body")}
            />
          </Field>
          {formError ? <p className="font-body text-sm text-cadence-red">{formError}</p> : null}
          <div className="flex gap-2">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Save"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setDialogState(null)}>
              Cancel
            </Button>
          </div>
        </form>
      </Dialog>
      {confirmDialog}
    </div>
  );
}
