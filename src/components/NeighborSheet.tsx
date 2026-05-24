"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Neighbor, Person } from "@/lib/types";

interface NeighborSheetProps {
  neighbor: Neighbor | null;
  isHome?: boolean;
  onClose: () => void;
  onSave: (id: string, updates: Partial<Neighbor>) => void;
  onPrev?: () => void;
  onNext?: () => void;
  /** e.g. "3 of 47" */
  position?: string;
}

function derivePeople(neighbor: Neighbor): Person[] {
  if (neighbor.people && neighbor.people.length > 0) {
    return neighbor.people.map((p) => ({
      name: p.name || "",
      phone: p.phone || "",
      email: p.email || "",
      profession: p.profession || "",
    }));
  }
  if (!neighbor.name) return [{ name: "", phone: "", email: "", profession: "" }];

  // Migrate from legacy format — handle shared last name:
  // "John & Allison Omalley" → ["John Omalley", "Allison Omalley"]
  if (!neighbor.name.includes(" & ")) {
    return [{ name: neighbor.name, phone: neighbor.phone || "", email: neighbor.email || "", profession: "" }];
  }

  const parts = neighbor.name.split(" & ");
  const left = parts[0].trim();
  const right = parts.slice(1).join(" & ").trim();
  const leftWords = left.split(" ");
  const rightWords = right.split(" ");

  // If left is a single word (first name only) and right has 2+ words,
  // the last word of right is the shared last name
  if (leftWords.length === 1 && rightWords.length >= 2) {
    const sharedLast = rightWords[rightWords.length - 1];
    const rightFirst = rightWords.slice(0, -1).join(" ");
    return [
      { name: `${left} ${sharedLast}`, phone: neighbor.phone || "", email: neighbor.email || "", profession: "" },
      { name: `${rightFirst} ${sharedLast}`, phone: "", email: "", profession: "" },
    ];
  }

  // Both already have full names, or both are just first names
  return [
    { name: left, phone: neighbor.phone || "", email: neighbor.email || "", profession: "" },
    { name: right, phone: "", email: "", profession: "" },
  ];
}

/** "Jerome & Mohini Schmitt" style — first names lead, shared last name trails */
function formatDisplayName(people: Person[]): string {
  const names = people.map((p) => p.name?.trim()).filter(Boolean);
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];

  const parsed = names.map((n) => {
    const parts = n.split(" ");
    if (parts.length === 1) return { first: parts[0], last: "" };
    return { first: parts.slice(0, -1).join(" "), last: parts[parts.length - 1] };
  });

  const lasts = parsed.map((p) => p.last.toLowerCase()).filter(Boolean);
  const sameLast = lasts.length === parsed.length && lasts.every((l) => l === lasts[0]);

  if (sameLast && parsed[0].last) {
    return parsed.map((p) => p.first).join(" & ") + " " + parsed[0].last;
  }

  // Different last names — just first names
  return parsed.map((p) => p.first).join(" & ");
}

/** Extract just first names: "Jerome Schmitt & Mohini Wagle" → "Jerome & Mohini" */
function firstNames(neighbor: Neighbor): string {
  const sources = neighbor.people?.length
    ? neighbor.people.map((p) => p.name).filter(Boolean)
    : neighbor.name
      ? neighbor.name.split(" & ").map((s) => s.trim()).filter(Boolean)
      : [];
  if (sources.length === 0) return "";
  const firsts = sources.map((n) => {
    const parts = n.split(" ");
    return parts[0];
  });
  return firsts.join(" & ");
}

/** Get a compact profession summary for the header */
function professionSummary(neighbor: Neighbor): string {
  const profs = (neighbor.people || [])
    .map((p) => p.profession)
    .filter(Boolean) as string[];
  if (profs.length === 0) return "";
  // Truncate long professions for the header
  return profs.map((p) => p.split(";")[0].trim()).join(" · ");
}

function housePhotoUrl(parcelId: string): string {
  return `https://iasworld.alleghenycounty.us/iasworld/iDoc2/Services/GetPhoto.ashx?parid=${parcelId}&jur=002&Rank=1&size=600x400`;
}

export default function NeighborSheet({
  neighbor,
  isHome,
  onClose,
  onSave,
  onPrev,
  onNext,
  position,
}: NeighborSheetProps) {
  const [people, setPeople] = useState<Person[]>([
    { name: "", phone: "", email: "" },
  ]);
  const [notes, setNotes] = useState("");
  const [isOwner, setIsOwner] = useState<boolean | null>(null);
  const [met, setMet] = useState(false);
  const [photo, setPhoto] = useState<string | undefined>(undefined);
  const [housePhotoLoaded, setHousePhotoLoaded] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const snapshotRef = useRef("");
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (neighbor) {
      const initPeople = derivePeople(neighbor);
      setPeople(initPeople);
      setNotes(neighbor.notes);
      setIsOwner(neighbor.isOwner);
      setMet(neighbor.met);
      setPhoto(neighbor.photo);
      setHousePhotoLoaded(false);
      snapshotRef.current = JSON.stringify({
        people: initPeople,
        notes: neighbor.notes,
        isOwner: neighbor.isOwner,
        met: neighbor.met,
        photo: neighbor.photo,
      });
      setTimeout(() => nameRef.current?.focus(), 300);
    }
  }, [neighbor]);

  const updatePerson = useCallback(
    (index: number, field: keyof Person, value: string) => {
      setPeople((prev) =>
        prev.map((p, i) => (i === index ? { ...p, [field]: value } : p))
      );
    },
    []
  );

  const addPerson = useCallback(() => {
    setPeople((prev) => [...prev, { name: "", phone: "", email: "", profession: "" }]);
  }, []);

  const removePerson = useCallback((index: number) => {
    setPeople((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handlePhoto = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
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
    },
    []
  );

  const saveIfChanged = useCallback(() => {
    if (!neighbor || isHome) return;
    const currentSnapshot = JSON.stringify({ people, notes, isOwner, met, photo });
    if (currentSnapshot === snapshotRef.current) return;
    const cleanPeople = people
      .map((p) => ({
        name: p.name?.trim() || "",
        phone: p.phone?.trim() || undefined,
        email: p.email?.trim() || undefined,
        profession: p.profession?.trim() || undefined,
      }))
      .filter((p) => p.name || p.phone || p.email);
    const displayName = formatDisplayName(cleanPeople);
    onSave(neighbor.id, {
      name: displayName,
      people: cleanPeople.length > 0 ? cleanPeople : undefined,
      notes,
      isOwner,
      met: met || cleanPeople.some((p) => !!p.name),
      photo,
      email: undefined,
      phone: undefined,
    });
  }, [neighbor, isHome, people, notes, isOwner, met, photo, onSave]);

  const handleSwipeStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleSwipeEnd = useCallback(
    (e: React.TouchEvent) => {
      const dx = e.changedTouches[0].clientX - touchStartX.current;
      const dy = e.changedTouches[0].clientY - touchStartY.current;
      // Only count horizontal swipes (not vertical scrolling)
      if (Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx)) return;
      saveIfChanged();
      if (dx < 0 && onNext) onNext(); // swipe left = next (higher number)
      if (dx > 0 && onPrev) onPrev(); // swipe right = prev (lower number)
    },
    [saveIfChanged, onNext, onPrev]
  );

  if (!neighbor) return null;

  const { property } = neighbor;

  const currentSnapshot = JSON.stringify({
    people,
    notes,
    isOwner,
    met,
    photo,
  });
  const hasChanges = currentSnapshot !== snapshotRef.current;

  function handleSave() {
    if (!neighbor) return;
    const cleanPeople = people
      .map((p) => ({
        name: p.name?.trim() || "",
        phone: p.phone?.trim() || undefined,
        email: p.email?.trim() || undefined,
        profession: p.profession?.trim() || undefined,
      }))
      .filter((p) => p.name || p.phone || p.email);

    const displayName = formatDisplayName(cleanPeople);

    onSave(neighbor.id, {
      name: displayName,
      people: cleanPeople.length > 0 ? cleanPeople : undefined,
      notes,
      isOwner,
      met: met || cleanPeople.some((p) => !!p.name),
      photo,
      email: undefined,
      phone: undefined,
    });
    onClose();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
  }

  function dismiss() {
    if (hasChanges) handleSave();
    else onClose();
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/20 z-40 backdrop-blur-[1px]"
        onClick={dismiss}
      />
      <div
        ref={sheetRef}
        className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl max-h-[85dvh] overflow-y-auto animate-slide-up"
        onTouchStart={handleSwipeStart}
        onTouchEnd={handleSwipeEnd}
      >
        {/* House photo banner */}
        <div className="relative">
          <div className="w-10 h-1 bg-stone-300 rounded-full mx-auto mt-3 mb-1 relative z-10" />
          <div
            className={`relative overflow-hidden ${housePhotoLoaded ? "h-40" : "h-0"} transition-[height] duration-300`}
          >
            <img
              src={housePhotoUrl(property.parcelId)}
              alt=""
              className="w-full h-full object-cover"
              onLoad={() => setHousePhotoLoaded(true)}
              onError={() => setHousePhotoLoaded(false)}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
            <div className="absolute bottom-3 left-5 right-12">
              <p className="text-lg font-semibold text-white drop-shadow-sm">
                {property.houseNumber} {property.street}
              </p>
              {isHome ? (
                <span className="inline-block mt-0.5 text-xs font-medium text-amber-200 bg-amber-900/40 px-2 py-0.5 rounded-full">
                  Your home
                </span>
              ) : (
                <>
                  {firstNames(neighbor) && (
                    <p className="text-sm text-white/90 drop-shadow-sm">
                      {firstNames(neighbor)}
                    </p>
                  )}
                  {professionSummary(neighbor) && (
                    <p className="text-xs text-white/70 drop-shadow-sm mt-0.5 line-clamp-1">
                      {professionSummary(neighbor)}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Fallback header when no house photo */}
          {!housePhotoLoaded && (
            <div className="px-5 pt-2 pb-2 border-b border-stone-100">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-lg font-semibold text-stone-900">
                    {property.houseNumber} {property.street}
                  </p>
                  {isHome ? (
                    <span className="inline-block mt-0.5 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                      Your home
                    </span>
                  ) : (
                    <>
                      {firstNames(neighbor) && (
                        <p className="text-sm text-stone-500">
                          {firstNames(neighbor)}
                        </p>
                      )}
                      {professionSummary(neighbor) && (
                        <p className="text-xs text-stone-400 mt-0.5 line-clamp-1">
                          {professionSummary(neighbor)}
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          <button
            onClick={dismiss}
            className="absolute top-3 right-3 z-10 text-stone-400 hover:text-stone-600 p-1 bg-white/80 rounded-full backdrop-blur-sm"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>

          {/* Swipe navigation arrows */}
          {!isHome && (onPrev || onNext) && (
            <>
              {onPrev && (
                <button
                  onClick={() => { saveIfChanged(); onPrev(); }}
                  className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-white/80 backdrop-blur-sm text-stone-400 hover:text-stone-700 shadow-sm"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              )}
              {onNext && (
                <button
                  onClick={() => { saveIfChanged(); onNext(); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-white/80 backdrop-blur-sm text-stone-400 hover:text-stone-700 shadow-sm"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              )}
            </>
          )}
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
                      <svg
                        className="w-8 h-8 text-stone-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                        />
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
                <label className="block text-sm font-medium text-stone-600 mb-2">
                  Who lives here?
                </label>
                <div className="space-y-4">
                  {people.map((person, idx) => (
                    <div key={idx} className="space-y-2">
                      <div className="flex gap-2">
                        <input
                          ref={idx === 0 ? nameRef : undefined}
                          type="text"
                          value={person.name}
                          onChange={(e) =>
                            updatePerson(idx, "name", e.target.value)
                          }
                          onKeyDown={handleKeyDown}
                          placeholder="Name"
                          className="flex-1 rounded-lg border border-stone-200 px-3 py-2.5 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900 text-base"
                        />
                        {people.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removePerson(idx)}
                            className="px-2 text-stone-300 hover:text-stone-500 transition-colors"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        value={person.profession || ""}
                        onChange={(e) =>
                          updatePerson(idx, "profession", e.target.value)
                        }
                        onKeyDown={handleKeyDown}
                        placeholder="Profession"
                        className="rounded-lg border border-stone-200 px-3 py-2 text-stone-700 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900 text-sm"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="tel"
                          value={person.phone || ""}
                          onChange={(e) =>
                            updatePerson(idx, "phone", e.target.value)
                          }
                          onKeyDown={handleKeyDown}
                          placeholder="Phone"
                          className="rounded-lg border border-stone-200 px-3 py-2 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900 text-sm"
                        />
                        <input
                          type="email"
                          value={person.email || ""}
                          onChange={(e) =>
                            updatePerson(idx, "email", e.target.value)
                          }
                          onKeyDown={handleKeyDown}
                          placeholder="Email"
                          className="rounded-lg border border-stone-200 px-3 py-2 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900 text-sm"
                        />
                      </div>
                    </div>
                  ))}
                </div>
                {people.length < 4 && (
                  <button
                    type="button"
                    onClick={addPerson}
                    className="mt-2 text-sm text-stone-400 hover:text-stone-600 transition-colors flex items-center gap-1"
                  >
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                    Add another person
                  </button>
                )}
                {people.some((p) => p.name) && !neighbor.met && (
                  <p className="mt-2 text-xs text-stone-400">
                    From county records — edit if this is a renter or has
                    changed
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
                    <svg
                      className="w-3 h-3 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </div>
                <span className="text-sm text-stone-700">
                  I&apos;ve met them
                </span>
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

          {position && !isHome && (
            <p className="text-center text-xs text-stone-400">{position}</p>
          )}

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
