"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { notFound, useParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { answerPrivacyRequest, getPrivacyRequest, privacyRequestKeys } from "@/features/privacy/api";
import { applyFieldErrors, isNotFound, messageFrom } from "@/shared/lib/errors";
import {
  PRIVACY_REQUEST_STATUS_LABELS,
  PRIVACY_REQUEST_TYPE_LABELS,
  type PrivacyRequestStatus,
  type PrivacyRequestType,
} from "@/shared/lib/status-labels";
import { Badge, Button, Field } from "@/shared/ui";

const answerSchema = z.object({ response_note: z.string().min(1, "A response note is required.") });
type AnswerFormValues = z.infer<typeof answerSchema>;
const FIELD_NAMES = Object.keys(answerSchema.shape);

export default function PrivacyRequestDetailPage() {
  const { id: requestId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: privacyRequestKeys.detail(requestId),
    queryFn: () => getPrivacyRequest(requestId),
    retry: false,
  });

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<AnswerFormValues>({ resolver: zodResolver(answerSchema) });

  if (query.isError && isNotFound(query.error)) notFound();

  async function submit(values: AnswerFormValues) {
    setFormError(null);
    try {
      await answerPrivacyRequest(requestId, values);
      await queryClient.invalidateQueries({ queryKey: privacyRequestKeys.detail(requestId) });
    } catch (error) {
      const matched = applyFieldErrors(setError, error, FIELD_NAMES);
      if (!matched) setFormError(messageFrom(error));
    }
  }

  if (query.isLoading) return <p className="font-body text-sm text-cadence-ink/60">Loading…</p>;
  if (query.isError) return <p className="font-body text-sm text-cadence-red">{messageFrom(query.error)}</p>;
  const request = query.data;
  if (!request) return null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-3xl text-cadence-ink">
          {PRIVACY_REQUEST_TYPE_LABELS[request.type as PrivacyRequestType]} request
        </h1>
        <div className="mt-1 flex items-center gap-2">
          <Badge tone={request.status === "answered" ? "positive" : "warning"}>
            {PRIVACY_REQUEST_STATUS_LABELS[request.status as PrivacyRequestStatus]}
          </Badge>
          <span className="font-body text-sm text-cadence-ink/60">Received {request.received_on}</span>
        </div>
      </div>

      {request.type === "access" ? (
        <a
          href={`/api/v1/privacy/requests/${requestId}/export/`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-10 w-fit items-center rounded-md bg-cadence-red px-4 font-body text-sm text-white hover:bg-cadence-red/90"
        >
          Export full record
        </a>
      ) : (
        <p className="font-body text-sm text-cadence-ink/60">
          Correction requests are answered directly — record what changed in the response note.
        </p>
      )}

      {request.response_note ? (
        <div>
          <h2 className="font-subheading text-xl text-cadence-ink">Response</h2>
          <p className="mt-1 whitespace-pre-wrap font-body text-sm text-cadence-ink">
            {request.response_note}
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit(submit)} noValidate className="flex max-w-xl flex-col gap-4">
          <Field label="Response note" htmlFor="pr-note" error={errors.response_note?.message}>
            <textarea
              id="pr-note"
              rows={4}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm font-body text-cadence-ink"
              {...register("response_note")}
            />
          </Field>
          {formError ? <p className="font-body text-sm text-cadence-red">{formError}</p> : null}
          <Button type="submit" disabled={isSubmitting} className="self-start">
            {isSubmitting ? "Saving…" : "Mark answered"}
          </Button>
        </form>
      )}
    </div>
  );
}
