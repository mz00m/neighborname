const SUFFIXES = new Set(["JR", "SR", "II", "III", "IV", "V", "ESQ"]);

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

    const raw = spanMatch[1]
      .replace(/<b>/gi, "")
      .replace(/<\/b>/gi, "")
      .replace(/Owner\s*Name:\s*/i, "")
      .replace(/&amp;/g, "&")
      .trim();

    if (!raw) return null;

    // Split by <BR> first — each line is a separate owner in LAST FIRST format.
    // Within a line, & means couple sharing the first person's last name.
    const lines = raw
      .split(/<br\s*\/?>/gi)
      .map((s) => s.replace(/\s+/g, " ").trim())
      .filter(Boolean);

    if (lines.length === 0) return null;

    return formatOwnerLines(lines);
  } catch {
    return null;
  }
}

interface ParsedName {
  first: string;
  last: string;
  suffix: string;
}

/**
 * Process owner lines from the county record.
 * Each line is either a person (LAST FIRST), a couple (LAST FIRST & SECOND),
 * or an entity (LLC, Trust, etc).
 */
function formatOwnerLines(lines: string[]): string {
  const people: ParsedName[] = [];

  for (const line of lines) {
    if (people.length >= 2) break;

    const cleaned = line
      .replace(/\s*\([^)]{0,10}\)\s*/g, "") // strip (W), (H), (THE), etc.
      .replace(/\s*\([^)]{0,10}\s*$/g, "")  // unclosed parens at end
      .replace(/\s+/g, " ")
      .trim();

    if (!cleaned) continue;

    // Skip non-person entities
    if (/^(CITY|COUNTY|STATE|COMMONWEALTH|HOUSING|URBAN|REDEVELOPMENT)/i.test(cleaned)) continue;

    // Strip trust suffixes to try to recover a person name
    const trustStripped = cleaned
      .replace(/\s+TRUST\s*&.*TRUSTEE\s*$/i, "")
      .replace(/\s+(REVOCABLE\s+)?LIVING\s+TRUST.*$/i, "")
      .replace(/\s+(REVOCABLE|IRREVOCABLE)\s+TRUST.*$/i, "")
      .replace(/\s+FAMILY\s+TRUST.*$/i, "")
      .replace(/\s+TRUST\s*\d*\s*$/i, "")
      .replace(/\s+TRUSTEE\s*$/i, "")
      .trim();

    // If it's a trust/entity, try to parse the stripped version; skip if still corporate
    const nameStr = trustStripped !== cleaned ? trustStripped : cleaned;
    if (/LLC|LP|ESTATE|CORP|INC|ASSOC|AUTHORITY|BANK|PARTNERS\s|PROPERTIES\s/i.test(nameStr)) continue;

    // Check for & couple on this line
    if (nameStr.includes("&")) {
      const couple = parseCoupleLine(nameStr);
      people.push(...couple);
    } else {
      const person = parseSinglePerson(nameStr);
      if (person) people.push(person);
    }
  }

  if (people.length === 0) {
    // Fallback: just title-case the first line
    return titleCase(lines[0]);
  }

  if (people.length === 1) {
    return formatParsedName(people[0]);
  }

  // Two people — format as couple
  if (people[0].last === people[1].last) {
    // Shared last name: "John & Allison Omalley"
    return `${people[0].first} & ${people[1].first} ${people[0].last}${people[0].suffix ? " " + people[0].suffix : ""}`;
  }

  // Different last names: "Jin Sun & Roy Gao"
  return `${formatParsedName(people[0])} & ${formatParsedName(people[1])}`;
}

function formatParsedName(p: ParsedName): string {
  let name = `${p.first} ${p.last}`;
  if (p.suffix) name += ` ${p.suffix}`;
  return name;
}

/**
 * Parse a single person from county format: LAST FIRST [MIDDLE] [SUFFIX]
 */
function parseSinglePerson(s: string): ParsedName | null {
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;

  const last = parts[0];
  const remaining = parts.slice(1);

  // Extract suffix from end
  let suffix = "";
  if (remaining.length > 1 && SUFFIXES.has(remaining[remaining.length - 1].toUpperCase())) {
    suffix = titleCase(remaining.pop()!);
  }

  // Keep substantive name parts (filter single-letter middle initials)
  const firstParts = remaining.filter((p) => p.length > 1);
  if (firstParts.length === 0 && remaining.length > 0) {
    firstParts.push(remaining[0]);
  }

  return {
    first: firstParts.map((p) => titleCase(p)).join(" "),
    last: titleCase(last),
    suffix,
  };
}

/**
 * Parse a couple line: LAST FIRST1 [MIDDLE] & FIRST2 [MIDDLE] [LAST?]
 * County format: right side of & is first name(s) sharing left's last name,
 * unless the right side explicitly repeats a (possibly different) last name.
 */
function parseCoupleLine(s: string): ParsedName[] {
  const ampIdx = s.indexOf("&");
  const leftStr = s.substring(0, ampIdx).trim();
  const rightStr = s.substring(ampIdx + 1).trim();

  const leftParts = leftStr.split(/\s+/).filter(Boolean);
  const rightParts = rightStr.split(/\s+/).filter(Boolean);

  if (leftParts.length < 2) return [];

  const sharedLast = leftParts[0];

  // Left person
  const leftRemaining = leftParts.slice(1);
  let leftSuffix = "";
  if (leftRemaining.length > 1 && SUFFIXES.has(leftRemaining[leftRemaining.length - 1].toUpperCase())) {
    leftSuffix = titleCase(leftRemaining.pop()!);
  }
  const leftFirst = leftRemaining.filter((p) => p.length > 1);
  if (leftFirst.length === 0 && leftRemaining.length > 0) leftFirst.push(leftRemaining[0]);

  const person1: ParsedName = {
    first: leftFirst.map((p) => titleCase(p)).join(" "),
    last: titleCase(sharedLast),
    suffix: leftSuffix,
  };

  if (rightParts.length === 0) return [person1];

  // Right person — determine if they share the last name or have their own
  // Check if the last word on the right matches the shared last name (redundant repeat)
  const rightLastWord = rightParts[rightParts.length - 1].toUpperCase();
  let rightFirstParts: string[];
  let rightLast: string;

  if (rightLastWord === sharedLast.toUpperCase() && rightParts.length > 1) {
    // Explicit repeat of shared last name: "NICHOLAS J ROSATO" with ROSATO as shared
    rightFirstParts = rightParts.slice(0, -1);
    rightLast = sharedLast;
  } else {
    // Right side shares the last name — all parts are first/middle
    // County format: LAST FIRST1 & FIRST2 (right side = first name only)
    rightFirstParts = rightParts;
    rightLast = sharedLast;
  }

  // Extract suffix
  let rightSuffix = "";
  if (rightFirstParts.length > 1 && SUFFIXES.has(rightFirstParts[rightFirstParts.length - 1].toUpperCase())) {
    rightSuffix = titleCase(rightFirstParts.pop()!);
  }

  const rightFirst = rightFirstParts.filter((p) => p.length > 1);
  if (rightFirst.length === 0 && rightFirstParts.length > 0) rightFirst.push(rightFirstParts[0]);

  const person2: ParsedName = {
    first: rightFirst.map((p) => titleCase(p)).join(" "),
    last: titleCase(rightLast),
    suffix: rightSuffix,
  };

  return [person1, person2];
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

export async function scrapeOwnerNames(
  parcelIds: string[]
): Promise<Map<string, string>> {
  const owners = new Map<string, string>();
  const batchSize = 5;

  for (let i = 0; i < parcelIds.length; i += batchSize) {
    const batch = parcelIds.slice(i, i + batchSize);
    await Promise.allSettled(
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
