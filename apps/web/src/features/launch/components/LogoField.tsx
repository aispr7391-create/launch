"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { LOGO_MIN_PX, LOGO_TYPES, validateLogoDimensions, validateLogoFile } from "../validation";

export interface LogoValue {
  file: File;
  previewUrl: string;
  width: number;
  height: number;
}

function readDimensions(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("decode"));
    img.src = url;
  });
}

export function LogoField({
  value,
  onChange,
  error,
  disabled,
}: {
  value: LogoValue | null;
  onChange: (v: LogoValue | null) => void;
  error?: string;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [localError, setLocalError] = useState<string>();
  const [dragging, setDragging] = useState(false);

  // Release the object URL when the logo is replaced or the form unmounts.
  useEffect(() => {
    const url = value?.previewUrl;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [value?.previewUrl]);

  const accept = async (file: File | undefined) => {
    if (!file) return;
    setLocalError(undefined);
    const typeErr = validateLogoFile(file);
    if (typeErr) return setLocalError(typeErr);
    const url = URL.createObjectURL(file);
    try {
      const { width, height } = await readDimensions(url);
      const dimErr = validateLogoDimensions(width, height);
      if (dimErr) {
        URL.revokeObjectURL(url);
        return setLocalError(dimErr);
      }
      onChange({ file, previewUrl: url, width, height });
    } catch {
      URL.revokeObjectURL(url);
      setLocalError("This image could not be read. Try another file.");
    }
  };

  const shownError = localError ?? error;

  return (
    <div>
      <p className="mb-1.5 text-[13px] font-medium">Token logo</p>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!disabled) accept(e.dataTransfer.files?.[0]);
        }}
        className={cn(
          "flex items-center gap-4 rounded-xl border border-dashed p-4 transition",
          dragging ? "border-accent bg-accent-soft" : shownError ? "border-down/60" : "border-line-strong",
        )}
      >
        <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-2xl border border-line bg-raised">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value.previewUrl} alt="Logo preview" className="size-full object-cover" />
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="text-faint" aria-hidden>
              <path d="M4 16l4-4 4 4 3-3 5 5M4 4h16v16H4zM15 8.5a1 1 0 1 0 0 .01" />
            </svg>
          )}
        </div>
        <div className="min-w-0 flex-1">
          {value ? (
            <>
              <p className="truncate text-sm">{value.file.name}</p>
              <p className="num text-[12px] text-faint">
                {value.width}×{value.height}px · {(value.file.size / 1024 / 1024).toFixed(2)} MB
              </p>
              <div className="mt-2 flex gap-2">
                <Button size="sm" type="button" disabled={disabled} onClick={() => inputRef.current?.click()}>
                  Change
                </Button>
                <Button size="sm" type="button" variant="ghost" disabled={disabled} onClick={() => onChange(null)}>
                  Remove
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm">Drop an image here or</p>
              <Button size="sm" type="button" className="mt-2" disabled={disabled} onClick={() => inputRef.current?.click()}>
                Choose file
              </Button>
            </>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={LOGO_TYPES.join(",")}
          className="sr-only"
          aria-label="Upload token logo"
          onChange={(e) => {
            accept(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
      {shownError ? (
        <p className="mt-1.5 text-[12px] text-down" role="alert">{shownError}</p>
      ) : (
        <p className="mt-1.5 text-[12px] text-faint">
          PNG, JPG/JPEG or WEBP · up to 5 MB · square, at least {LOGO_MIN_PX}×{LOGO_MIN_PX}px.
        </p>
      )}
    </div>
  );
}
