export async function scrapeOwnerName(parcelId: string): Promise<string | null> {
  try {
    const url = `https://realestate.alleghenycounty.us/GeneralInfo?ID=${parcelId}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; NeighborName/1.0)",
      },
    });
    if (!res.ok) return null;

    const html = await res.text();

    const spanMatch = html.match(
      /id="MainContent_InfoPane_ownerLbl"[^>]*>([\s\S]*?)<\/span>/
    );
    if (!spanMatch?.[1]) return null;

    const inner = spanMatch[1]
      .replace(/<b>/gi, "")
      .replace(/<\/b>/gi, "")
      .replace(/<br\s*\/?>/gi, " & ")
      .replace(/Owner\s*Name:\s*/i, "")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .trim();

    if (!inner) return null;

    return formatOwnerName(inner);
  } catch {
    return null;
  }
}

function formatOwnerName(raw: string): string {
  const cleaned = raw
    .replace(/\s*\([WHMwhm][^)]*\)\s*/g, "")
    .replace(/\s*\([WHMwhm]\s*/g, "")
    .replace(/\)/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned || /^(CITY|COUNTY|STATE|COMMONWEALTH|HOUSING|URBAN|REDEVELOPMENT)/i.test(cleaned)) {
    return "";
  }

  // Strip trust suffixes and parse remainder as a person name
  const trustStripped = cleaned
    .replace(/\s+TRUST\s*&.*TRUSTEE\s*$/i, "")
    .replace(/\s+(REVOCABLE|IRREVOCABLE)\s+TRUST$/i, "")
    .replace(/\s+FAMILY\s+TRUST$/i, "")
    .replace(/\s+TRUST$/i, "")
    .replace(/\s+TRUSTEE$/i, "")
    .trim();

  if (trustStripped && trustStripped !== cleaned) {
    return formatPersonName(trustStripped);
  }

  if (/LLC|LP|ESTATE|CORP|INC|ASSOC|AUTHORITY|BANK/i.test(cleaned)) {
    return titleCase(cleaned);
  }

  return formatPersonName(cleaned);
}

function formatPersonName(cleaned: string): string {
  const ampersandCount = (cleaned.match(/&/g) || []).length;
  if (ampersandCount === 1) {
    return formatCouple(cleaned);
  }
  if (ampersandCount > 1) {
    const firstAmp = cleaned.indexOf("&");
    const simplifiedRaw = cleaned
      .substring(0, cleaned.indexOf("&", firstAmp + 1))
      .trim();
    return formatCouple(simplifiedRaw);
  }

  const parts = cleaned.split(/\s+/);
  if (parts.length >= 2) {
    return toTitleCase(parts);
  }

  return titleCase(cleaned);
}

function formatCouple(raw: string): string {
  const sides = raw.split(/\s*&\s*/);
  if (sides.length !== 2) return toTitleCase(raw.split(/\s+/));

  const left = sides[0].trim().split(/\s+/);
  const right = sides[1].trim().split(/\s+/);

  const lastName1 = left[0];
  const firstName1 = left.slice(1).filter((p) => p.length > 1).join(" ");

  if (right.length === 1) {
    const first1 = titleCase(firstName1);
    const first2 = titleCase(right[0]);
    const last = titleCase(lastName1);
    return `${first1} & ${first2} ${last}`;
  }

  const rightHasDifferentLast =
    right[0].toUpperCase() !== lastName1.toUpperCase();

  if (rightHasDifferentLast) {
    const firstName2 = right.slice(1).filter((p) => p.length > 1).join(" ");
    const first1 = firstName1 ? titleCase(firstName1) : titleCase(lastName1);
    const first2 = firstName2 ? titleCase(firstName2) : titleCase(right[0]);
    return `${first1} & ${first2}`;
  }

  const firstName2 = right
    .filter((p) => p.toUpperCase() !== lastName1.toUpperCase() && p.length > 1)
    .join(" ");

  const name1 = titleCase(firstName1);
  const name2 = titleCase(firstName2);
  const last = titleCase(lastName1);

  if (name2) {
    return `${name1} & ${name2} ${last}`;
  }
  return `${name1} ${last}`;
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) =>
      word
        .split("-")
        .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : ""))
        .join("-")
    )
    .join(" ");
}

function toTitleCase(parts: string[]): string {
  if (parts.length === 0) return "";
  if (parts.length === 1) return titleCase(parts[0]);

  const lastName = parts[0];
  const firstNames = parts.slice(1);
  return `${firstNames.map((n) => titleCase(n)).join(" ")} ${titleCase(lastName)}`;
}

export async function scrapeOwnerNames(
  parcelIds: string[]
): Promise<Map<string, string>> {
  const owners = new Map<string, string>();
  const batchSize = 5;

  for (let i = 0; i < parcelIds.length; i += batchSize) {
    const batch = parcelIds.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(async (id) => {
        const name = await scrapeOwnerName(id);
        if (name) owners.set(id, name);
      })
    );
    if (i + batchSize < parcelIds.length) {
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  return owners;
}
