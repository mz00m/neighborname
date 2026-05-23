"use client";

import { useState, useRef, useEffect } from "react";

interface AddStreetDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (streetName: string) => void;
  loading: boolean;
  error: string;
}

export default function AddStreetDialog({
  open,
  onClose,
  onAdd,
  loading,
  error,
}: AddStreetDialogProps) {
  const [street, setStreet] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setStreet("");
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [open]);

  if (!open) return null;

  function handleSubmit() {
    if (street.trim()) onAdd(street.trim());
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-50 backdrop-blur-[1px]" onClick={onClose} />
      <div className="fixed top-1/3 left-4 right-4 z-50 bg-white rounded-2xl shadow-2xl p-5 max-w-sm mx-auto animate-slide-up">
        <h3 className="text-lg font-semibold text-stone-900 mb-1">Add a street</h3>
        <p className="text-sm text-stone-500 mb-4">
          Pull in all properties and owners from another street nearby.
        </p>

        <input
          ref={inputRef}
          type="text"
          value={street}
          onChange={(e) => setStreet(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="Winterton St"
          className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900 text-base mb-3"
          disabled={loading}
        />

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">{error}</p>
        )}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 rounded-lg border border-stone-200 px-4 py-2.5 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !street.trim()}
            className="flex-1 rounded-lg bg-stone-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-stone-800 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-3.5 w-3.5 border-2 border-stone-400 border-t-white rounded-full animate-spin" />
                Loading...
              </span>
            ) : (
              "Add Street"
            )}
          </button>
        </div>
      </div>
    </>
  );
}
