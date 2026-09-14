"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Input } from "@/shared/ui/Field";

/** URL-driven list find. Filters rows already returned by the list API. */
export function SearchField({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  label: string;
}) {
  const id = useId();
  const [draft, setDraft] = useState(value);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (draft !== value) onChangeRef.current(draft);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [draft, value]);

  return (
    <div className="w-full max-w-sm">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Input
        id={id}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        type="search"
      />
    </div>
  );
}
