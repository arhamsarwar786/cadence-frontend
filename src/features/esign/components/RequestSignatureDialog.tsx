"use client";

import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useId, useMemo, useState, type DragEvent } from "react";
import { createSignatureRequests, signatureRequestKeys } from "@/features/esign/api";
import type { SignatureRequest } from "@/features/esign/types";
import { listWorkers, workerKeys } from "@/features/workers/api";
import type { EmployeeList } from "@/features/workers/types";
import { cn } from "@/shared/lib/cn";
import { messageFrom } from "@/shared/lib/errors";
import { matchesQuery } from "@/shared/lib/matches";
import { Button, Dialog, Field, Input, QueryError, useToast } from "@/shared/ui";

const WORKER_PAGE_SIZE = 200;
const LABEL_MAX = 255;

function workerName(w: Pick<EmployeeList, "first_name" | "last_name">): string {
  return `${w.first_name} ${w.last_name}`.trim();
}

/** The manual assign door's modal: one PDF, one worker (or several), an
 * optional label. The server is the gate for everything — PDF shape, page
 * cap, size, signer reachability — and its refusal is shown verbatim. A
 * bulk refusal writes nothing, so the list is only refreshed on success. */
export function RequestSignatureDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const fileInputId = useId();
  const searchId = useId();
  const labelId = useId();

  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [multi, setMulti] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [label, setLabel] = useState("");
  const [created, setCreated] = useState<SignatureRequest[] | null>(null);

  // Org-scoped by the server (selectors.list_workers); the list door has no
  // name search, so pages are pulled in and found client-side.
  const workersQuery = useInfiniteQuery({
    queryKey: [...workerKeys.all, "esign-picker"],
    queryFn: ({ pageParam }) => listWorkers({ page: pageParam, pageSize: WORKER_PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (last, pages) => (last.next ? pages.length + 1 : undefined),
    enabled: open,
  });

  const workers = useMemo(
    () => workersQuery.data?.pages.flatMap((p) => p.results) ?? [],
    [workersQuery.data],
  );
  const byId = useMemo(() => new Map(workers.map((w) => [w.id, w])), [workers]);
  const visible = useMemo(
    () =>
      workers.filter(
        (w) => matchesQuery(workerName(w), search) || matchesQuery(w.email ?? "", search),
      ),
    [workers, search],
  );

  const mutation = useMutation({
    mutationFn: createSignatureRequests,
    onSuccess: async (rows) => {
      await queryClient.invalidateQueries({ queryKey: signatureRequestKeys.all });
      toast.success(
        rows.length === 1
          ? "Signature request sent."
          : `${rows.length} signature requests sent.`,
      );
      if (rows.length > 1) {
        setCreated(rows);
      } else {
        close();
      }
    },
  });

  function reset() {
    setFile(null);
    setDragging(false);
    setMulti(false);
    setSelected([]);
    setSearch("");
    setLabel("");
    setCreated(null);
    mutation.reset();
  }

  function close() {
    reset();
    onClose();
  }

  function pickFile(next: File | null | undefined) {
    if (!next) return;
    setFile(next);
    mutation.reset();
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    pickFile(event.dataTransfer.files?.[0]);
  }

  function toggleWorker(id: string) {
    mutation.reset();
    if (!multi) {
      setSelected([id]);
      return;
    }
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function setMode(nextMulti: boolean) {
    setMulti(nextMulti);
    // Dropping to single keeps the first pick, never a silent swap.
    if (!nextMulti) setSelected((prev) => prev.slice(0, 1));
  }

  const canSubmit = Boolean(file) && selected.length > 0 && !mutation.isPending;

  function submit() {
    if (!file || selected.length === 0) return;
    mutation.mutate({ file, employeeIds: selected, label });
  }

  if (created) {
    return (
      <Dialog open={open} onClose={close} title="Requests sent">
        <div className="flex flex-col gap-4">
          <p className="font-body text-sm">
            {created.length} workers were sent the document. Each request is pending until
            they sign or decline it in their portal.
          </p>
          <ul className="scroll-area-y flex max-h-64 flex-col divide-y divide-current/10 rounded-xl border border-current/10">
            {created.map((row, index) => {
              const worker = byId.get(selected[index]);
              return (
                <li key={row.id} className="flex flex-col px-3 py-2">
                  <span className="font-body text-sm font-medium">
                    {worker ? workerName(worker) : row.signer_email}
                  </span>
                  <span className="font-body text-xs opacity-70">{row.signer_email}</span>
                </li>
              );
            })}
          </ul>
          <div className="flex justify-end">
            <Button onClick={close}>Done</Button>
          </div>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onClose={close} title="Request signature">
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="flex flex-col gap-1.5">
          <span className="font-body text-sm font-medium text-current/80">Document (PDF)</span>
          <label
            htmlFor={fileInputId}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border border-dashed px-4 py-6 text-center transition-colors",
              dragging ? "border-cadence-yellow bg-cadence-yellow/10" : "border-current/25 hover:bg-current/5",
            )}
          >
            {file ? (
              <>
                <span className="break-all font-body text-sm font-medium">{file.name}</span>
                <span className="font-body text-xs opacity-70">
                  {(file.size / 1024 / 1024).toFixed(2)} MB · click or drop to replace
                </span>
              </>
            ) : (
              <>
                <span className="font-body text-sm font-medium">Drop a PDF here</span>
                <span className="font-body text-xs opacity-70">or click to choose — up to 50 pages</span>
              </>
            )}
          </label>
          <input
            id={fileInputId}
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            onChange={(e) => {
              pickFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor={searchId} className="font-body text-sm font-medium text-current/80">
              {multi ? "Workers" : "Worker"}
            </label>
            <label className="flex items-center gap-2 font-body text-xs">
              <input
                type="checkbox"
                checked={multi}
                onChange={(e) => setMode(e.target.checked)}
                className="accent-cadence-yellow"
              />
              Send to several workers
            </label>
          </div>
          <Input
            id={searchId}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Find by name or email"
          />
          {workersQuery.isError ? (
            <QueryError error={workersQuery.error} onRetry={() => workersQuery.refetch()} />
          ) : (
            <div
              role={multi ? "group" : "radiogroup"}
              aria-label={multi ? "Workers" : "Worker"}
              className="scroll-area-y max-h-56 rounded-xl border border-current/10"
            >
              {workersQuery.isLoading ? (
                <p className="px-3 py-3 font-body text-sm opacity-70">Loading workers…</p>
              ) : visible.length === 0 ? (
                <p className="px-3 py-3 font-body text-sm opacity-70">No workers match.</p>
              ) : (
                <ul className="divide-y divide-current/10">
                  {visible.map((w) => {
                    const checked = selected.includes(w.id);
                    return (
                      <li key={w.id}>
                        <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-current/5">
                          <input
                            type={multi ? "checkbox" : "radio"}
                            name="esign-worker"
                            checked={checked}
                            onChange={() => toggleWorker(w.id)}
                            className="accent-cadence-yellow"
                          />
                          <span className="flex min-w-0 flex-col">
                            <span className="truncate font-body text-sm">{workerName(w)}</span>
                            <span className="truncate font-body text-xs opacity-70">
                              {w.email || "No email on file"}
                            </span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
              {workersQuery.hasNextPage ? (
                <div className="border-t border-current/10 p-2 text-center">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={workersQuery.isFetchingNextPage}
                    onClick={() => workersQuery.fetchNextPage()}
                  >
                    {workersQuery.isFetchingNextPage ? "Loading…" : "Load more workers"}
                  </Button>
                </div>
              ) : null}
            </div>
          )}
          {multi && selected.length > 0 ? (
            <p className="font-body text-xs opacity-80">{selected.length} selected</p>
          ) : null}
        </div>

        <Field
          label="Label (optional)"
          htmlFor={labelId}
          hint="Shown in the invitation. Defaults to the file name."
        >
          <Input
            id={labelId}
            value={label}
            maxLength={LABEL_MAX}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={file?.name ?? "e.g. Site safety policy"}
          />
        </Field>

        {mutation.isError ? (
          <p role="alert" className="font-body text-sm text-cadence-red">
            {messageFrom(mutation.error)}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={close} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" disabled={!canSubmit}>
            {mutation.isPending
              ? "Sending…"
              : selected.length > 1
                ? `Send to ${selected.length} workers`
                : "Send request"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
