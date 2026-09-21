"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/Button";

export interface SignaturePadHandle {
  clear: () => void;
  getDataUrl: (type?: string, quality?: number) => string | null;
  toBlob: (type?: string, quality?: number) => Promise<Blob | null>;
  isEmpty: () => boolean;
}

export interface SignaturePadProps {
  className?: string;
  height?: number;
  label?: string;
  onChange?: (empty: boolean) => void;
}

/** Touch-friendly canvas signature pad for portal consent / onboarding. */
export const SignaturePad = forwardRef<SignaturePadHandle, SignaturePadProps>(
  function SignaturePad({ className, height = 180, label = "Signature", onChange }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawing = useRef(false);
    const empty = useRef(true);
    const [hasMark, setHasMark] = useState(false);

    const resize = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = window.devicePixelRatio || 1;
      const width = parent.clientWidth;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = 2.25;
      ctx.strokeStyle = "#1a1a1a";
    }, [height]);

    useEffect(() => {
      resize();
      window.addEventListener("resize", resize);
      return () => window.removeEventListener("resize", resize);
    }, [resize]);

    function pointFromEvent(event: ReactPointerEvent<HTMLCanvasElement>) {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }

    function markDirty() {
      if (!empty.current) return;
      empty.current = false;
      setHasMark(true);
      onChange?.(false);
    }

    function onPointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      const point = pointFromEvent(event);
      if (!canvas || !ctx || !point) return;
      canvas.setPointerCapture(event.pointerId);
      drawing.current = true;
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
      markDirty();
    }

    function onPointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
      if (!drawing.current) return;
      const ctx = canvasRef.current?.getContext("2d");
      const point = pointFromEvent(event);
      if (!ctx || !point) return;
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
    }

    function onPointerUp(event: ReactPointerEvent<HTMLCanvasElement>) {
      drawing.current = false;
      try {
        canvasRef.current?.releasePointerCapture(event.pointerId);
      } catch {
        /* ignore */
      }
    }

    const clear = useCallback(() => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
      empty.current = true;
      setHasMark(false);
      onChange?.(true);
    }, [onChange]);

    useImperativeHandle(
      ref,
      () => ({
        clear,
        isEmpty: () => empty.current,
        getDataUrl: (type = "image/png", quality) => {
          if (empty.current || !canvasRef.current) return null;
          return canvasRef.current.toDataURL(type, quality);
        },
        toBlob: (type = "image/png", quality) => {
          return new Promise((resolve) => {
            if (empty.current || !canvasRef.current) {
              resolve(null);
              return;
            }
            canvasRef.current.toBlob((blob) => resolve(blob), type, quality);
          });
        },
      }),
      [clear],
    );

    return (
      <div className={cn("flex flex-col gap-2 font-body", className)}>
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-cadence-ink">{label}</p>
          <Button type="button" size="sm" variant="ghost" onClick={clear} disabled={!hasMark}>
            Clear
          </Button>
        </div>
        <div className="overflow-hidden rounded-2xl border border-border bg-white touch-none">
          <canvas
            ref={canvasRef}
            role="img"
            aria-label={label}
            className="block w-full cursor-crosshair"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          />
        </div>
        <p className="font-fine text-[10px] uppercase tracking-wide text-cadence-ink/45">
          Sign with finger or stylus
        </p>
      </div>
    );
  },
);
