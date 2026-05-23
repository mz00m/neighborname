"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Neighbor } from "@/lib/types";

interface NeighborSheetProps {
  neighbor: Neighbor | null;
  isHome?: boolean;
  onClose: () => void;
  onSave: (id: string, updates: Partial<Neighbor>) => void;
}

export default function NeighborSheet({
  neighbor,
  isHome,
  onClose,
  onSave,
}: NeighborSheetProps) {
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [isOwner, setIsOwner] = useState<boolean | null>(null);
  const [met, setMet] = useState(false);
  const [photo, setPhoto] = useState<string | undefined>(undefined);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (neighbor) {
      setName(neighbor.name);
      setNotes(neighbor.notes);
      setIsOwner(neighbor.isOwner);
      setMet(neighbor.met);
      setPhoto(neighbor.photo);
      setEmail(neighbor.email || "");
      setPhone(neighbor.phone || "");
      setTimeout(() => nameRef.current?.focus(), 300);
    }
  }, [neighbor]);

  const handlePhoto = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 400;
        let w = img.width;
        let h = img.height;
        if (w > max || h > max) {
          const scale = max / Math.max(w, h);
          w = Math.round(w * scale);
          h = Math.round(h * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
        setPhoto(canvas.toDataURL("image/jpeg", 0.8));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }, []);

  if (!neighbor) return null;

  const { property } = neighbor;
  const hasChanges =
    name !== neighbor.name ||
    notes !== neighbor.notes ||
    isOwner !== neighbor.isOwner ||
    met !== neighbor.met ||
    photo !== neighbor.photo ||
    email !== (neighbor.email || "") ||
    phone !== (neighbor.phone || "");

  function handleSave() {
    if (!neighbor) return;
    onSave(neighbor.id, {
      name,
      notes,
      isOwner,
      met: met || !!name,
      photo,
      email: email || undefined,
      phone: phone || undefined,
    });
    onClose();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/20 z-40 backdrop-blur-[1px]"
        onClick={() => {
          if (hasChanges) handleSave();
          else onClose();
        }}
      />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl max-h-[85dvh] overflow-y-auto animate-slide-up">
        <div className="sticky top-0 bg-white pt-3 pb-2 px-5 border-b border-stone-100">
          <div className="w-10 h-1 bg-stone-300 rounded-full mx-auto mb-3" />
          <div className="flex items-start justify-between">
            <div>
              <p className="text-lg font-semibold text-stone-900">
                {property.houseNumber} {property.street}
              </p>
              {isHome && (
                <span className="inline-block mt-0.5 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                  Your home
                </span>
              )}
            </div>
            <button
              onClick={() => {
                if (hasChanges) handleSave();
                else onClose();
              }}
              className="text-stone-400 hover:text-stone-600 p-1"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="px-5 py-4 space-y-5">
          {!isHome && (
            <>
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="relative group"
                >
                  {photo ? (
                    <img
                      src={photo}
                      alt=""
                      className="w-20 h-20 rounded-full object-cover ring-2 ring-stone-200"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-stone-100 flex items-center justify-center ring-2 ring-stone-200">
                      <svg className="w-8 h-8 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                  )}
                  <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                    <span className="text-white opacity-0 group-hover:opacity-100 text-xs font-medium transition-opacity">
                      {photo ? "Change" : "Add"}
                    </span>
                  </div>
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  capture="user"
                  onChange={handlePhoto}
                  className="hidden"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-600 mb-1">
                  Who lives here?
                </label>
                <input
                  ref={nameRef}
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Name"
                  className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900 text-base"
                />
                {name && !neighbor.met && (
                  <p className="mt-1 text-xs text-stone-400">
                    From county records — edit if this is a renter or has changed
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                {[
                  { label: "Owner", value: true },
                  { label: "Renter", value: false },
                  { label: "Not sure", value: null },
                ].map((opt) => (
                  <button
                    key={opt.label}
                    onClick={() => setIsOwner(opt.value)}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      isOwner === opt.value
                        ? "border-stone-900 bg-stone-900 text-white"
                        : "border-stone-200 text-stone-600 hover:border-stone-400"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-stone-600 mb-1">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="412-555-1234"
                    className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-600 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="name@email.com"
                    className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-600 mb-1">
                  Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Kids, pets, works at..., moved in 2023"
                  rows={2}
                  className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900 text-sm resize-none"
                />
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                    met
                      ? "bg-emerald-600 border-emerald-600"
                      : "border-stone-300"
                  }`}
                >
                  {met && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span className="text-sm text-stone-700">I&apos;ve met them</span>
                <input
                  type="checkbox"
                  checked={met}
                  onChange={(e) => setMet(e.target.checked)}
                  className="sr-only"
                />
              </label>
            </>
          )}

          <div className="border-t border-stone-100 pt-4">
            <p className="text-xs font-medium text-stone-500 uppercase tracking-wider mb-2">
              Property Details
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {property.yearBuilt && (
                <Detail label="Built" value={String(property.yearBuilt)} />
              )}
              {property.style && (
                <Detail label="Style" value={property.style} />
              )}
              {property.bedrooms && (
                <Detail label="Beds" value={String(property.bedrooms)} />
              )}
              {property.bathrooms && (
                <Detail label="Baths" value={String(property.bathrooms)} />
              )}
              {property.livingArea && (
                <Detail
                  label="Size"
                  value={`${property.livingArea.toLocaleString()} sqft`}
                />
              )}
              {property.lotArea && (
                <Detail
                  label="Lot"
                  value={`${property.lotArea.toLocaleString()} sqft`}
                />
              )}
              {property.stories && (
                <Detail label="Stories" value={property.stories} />
              )}
              {property.lastSalePrice && (
                <Detail
                  label="Last sale"
                  value={`$${property.lastSalePrice.toLocaleString()}`}
                />
              )}
              {property.lastSaleDate && (
                <Detail label="Sale date" value={property.lastSaleDate} />
              )}
            </div>
          </div>

          {!isHome && hasChanges && (
            <button
              onClick={handleSave}
              className="w-full rounded-lg bg-stone-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-stone-800 transition-colors"
            >
              Save
            </button>
          )}
        </div>
      </div>
    </>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-stone-400">{label}</span>
      <span className="ml-1.5 text-stone-700">{value}</span>
    </div>
  );
}
