import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";
import { NeighborhoodData } from "@/lib/types";

function getSQL() {
  return neon(process.env.DATABASE_URL!);
}

// Profession data keyed by "houseNumber STREET" (uppercase street)
// Each entry maps first names to profession strings
// Only includes matches with 75%+ confidence from web cross-referencing
const PROFESSION_DATA: Record<string, Record<string, string>> = {
  // === CMU Faculty ===
  "1026 HEBERTON ST": {
    george: "Herbert A. Simon Professor of Economics & Psychology, CMU",
  },
  "6231 WELLESLEY AVE": {
    elizabeth: "Director, ICA Pittsburgh & Professor of Art, CMU",
  },
  "1132 WINTERTON ST": {
    esteban: "Physicist, Senior Scientist (CMU alum)",
  },
  "930 HEBERTON ST": {
    richard: "Associate Professor of Art, CMU; Founder, Center for PostNatural History",
  },
  "1114 HEBERTON ST": {
    peter: "Co-founder Attack Theatre; Teaching Professor of Dance, CMU",
    michele: "Co-founder Attack Theatre, CMU",
  },
  "948 HEBERTON ST": {
    robert: "Head of Dramatic Writing, CMU",
    joy: "Poet; NEA Fellow; teaches at Chatham MFA",
  },
  "957 WELLESLEY RD": {
    adam: "Distinguished Service Professor, CMU; CEO, Skilly",
  },
  "971 WELLESLEY RD": {
    laurence: "Professor of Economics, Tepper School of Business, CMU",
  },
  "6328 WELLESLEY AVE": {
    ralph: "Computer Vision Researcher, CMU",
  },

  // === Pitt Faculty ===
  "947 HEBERTON ST": {
    john: "Distinguished University Professor of Philosophy, Pitt",
  },
  "1103 WINTERTON ST": {
    andrew: "Andrew W. Mellon Professor of Anthropology, Pitt",
    pamela: "Research Associate, Anthropology, Pitt",
  },
  "1128 HEBERTON ST": {
    jonathan: "Professor & Chair, Dept of Mathematics, Pitt",
  },
  "6214 WELLESLEY AVE": {
    nancy: "Professor, Slavic Languages & Film Studies, Pitt",
  },
  "1130 HEBERTON ST": {
    edward: "Professor Emeritus of Psychiatry, Pitt; Chair, DOJ Science Advisory Board",
  },
  "970 WELLESLEY RD": {
    pat: "Dean Emeritus, School of Pharmacy, Pitt",
  },
  "939 HEBERTON ST": {
    fred: "Professor of Religious Studies, Pitt (emeritus)",
  },
  "1122 WINTERTON ST": {
    anthony: "Immunology Researcher, Pitt School of Medicine",
  },
  "921 WELLESLEY RD": {
    dave: "IT, University of Pittsburgh",
  },

  // === Medicine ===
  "1010 HEBERTON ST": {
    michael: "Pediatric Surgeon, UPMC Children's Hospital; Associate Professor, Pitt",
  },
  "6217 WELLESLEY AVE": {
    troy: "Neurologist, Allegheny Health Network",
  },
  "950 HEBERTON ST": {
    natalie: "Vascular Surgeon, UPMC",
  },
  "917 WELLESLEY RD": {
    alicia: "Pediatrician, UPMC Children's Hospital; Assistant Professor, Pitt",
  },
  "1103 HEBERTON ST": {
    sansea: "Child & Adolescent Psychiatrist; Director of Training, WPIC/Pitt",
  },

  // === Arts & Culture ===
  "951 WELLESLEY RD": {
    david: "Co-Principal Bassoon, Pittsburgh Symphony Orchestra",
  },
  "1232 WINTERTON ST": {
    hisham: "Artist & Filmmaker, IATSE Local 489",
  },
  "842 HEBERTON ST": {
    hilary: "Illustrator & Artist; Founder, Green Comma Media",
    damian: "Policy Analyst, US Dept of Health & Human Services",
  },
  "1027 WINTERTON ST": {
    sarah: "Manager of Operations, JFCS Pittsburgh; Musician",
  },

  // === Architecture & Design ===
  "1126 HEBERTON ST": {
    marc: "Architect; Co-founder evolveEA; LEED Fellow; Past AIA PA President",
  },
  "963 WELLESLEY RD": {
    david: "Creative Director, Dick's Sporting Goods",
  },

  // === Law ===
  "916 WELLESLEY RD": {
    gary: "Environmental Attorney, Babst Calland",
  },
  "924 HEBERTON ST": {
    john: "Family Law Attorney, Voelker & Morris",
  },

  // === Tech ===
  "943 WELLESLEY RD": {
    alex: "Staff SRE, Google DeepMind",
  },
  "1128 WINTERTON ST": {
    eben: "Game Director, Level Ex Games",
  },
  "1101 HEBERTON ST": {
    mark: "Director, Global Cyber Security, Citi",
  },
  "1208 WINTERTON ST": {
    joshua: "Statistician, RAND Corporation",
  },

  // === Nonprofit & Philanthropy ===
  "1133 WINTERTON ST": {
    ajoy: "Philanthropy Advisor (CZI, Schmidt Futures, Ballmer, Ford)",
  },
  "1136 WINTERTON ST": {
    cara: "Executive Director, Trying Together",
  },

  // === Other ===
  "935 HEBERTON ST": {
    david: "Senior Director, Willis Towers Watson (retired)",
  },
  "975 WELLESLEY RD": {
    barry: "Retired Math Teacher & Coach, Pittsburgh Public Schools",
  },
  "837 HEBERTON ST": {
    rachna: "Real Estate & Mortgage Lending",
  },
  "949 WELLESLEY RD": {
    michael: "Construction & Restoration, City Dwellings LLC",
  },
  "929 WELLESLEY RD": {
    brian: "Sales Manager, DQE Communications",
  },
  "1125 WINTERTON ST": {
    christopher: "Conservation Planning Manager, PA Natural Heritage Program",
  },
  "967 WELLESLEY RD": {
    dan: "Landscape Architecture",
  },
  "933 WELLESLEY RD": {
    alan: "President, Group Wellesley; Technical Writing",
  },
  "1013 HEBERTON ST": {
    jason: "Game Designer & Author; Elf Lair LLC",
  },
};

export async function POST() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "No database configured" }, { status: 500 });
  }

  try {
    const sql = getSQL();
    const rows = await sql`SELECT data FROM neighborhood WHERE id = 'default'`;
    if (rows.length === 0) {
      return NextResponse.json({ error: "No neighborhood data found" }, { status: 404 });
    }

    const data: NeighborhoodData =
      typeof rows[0].data === "string" ? JSON.parse(rows[0].data) : rows[0].data;

    let updated = 0;
    const matched: string[] = [];

    for (const neighbor of data.neighbors) {
      const addressKey = `${neighbor.property.houseNumber} ${neighbor.property.street}`;
      const professions = PROFESSION_DATA[addressKey];
      if (!professions) continue;

      // Ensure people array exists
      if (!neighbor.people || neighbor.people.length === 0) {
        if (neighbor.name?.includes(" & ")) {
          const parts = neighbor.name.split(" & ");
          const left = parts[0].trim();
          const right = parts.slice(1).join(" & ").trim();
          const leftWords = left.split(" ");
          const rightWords = right.split(" ");

          if (leftWords.length === 1 && rightWords.length >= 2) {
            const sharedLast = rightWords[rightWords.length - 1];
            const rightFirst = rightWords.slice(0, -1).join(" ");
            neighbor.people = [
              { name: `${left} ${sharedLast}` },
              { name: `${rightFirst} ${sharedLast}` },
            ];
          } else {
            neighbor.people = [{ name: left }, { name: right }];
          }
        } else if (neighbor.name) {
          neighbor.people = [{ name: neighbor.name }];
        }
      }

      if (!neighbor.people) continue;

      for (const person of neighbor.people) {
        if (!person.name) continue;
        const firstName = person.name.split(" ")[0].toLowerCase();

        if (professions[firstName]) {
          person.profession = professions[firstName];
          updated++;
          matched.push(`${person.name}: ${professions[firstName]}`);
        }
      }
    }

    data.lastUpdated = new Date().toISOString();
    const json = JSON.stringify(data);

    await sql`
      INSERT INTO neighborhood (id, data, updated_at)
      VALUES ('default', ${json}, NOW())
      ON CONFLICT (id) DO UPDATE
        SET data = EXCLUDED.data, updated_at = NOW()
    `;

    return NextResponse.json({ updated, matched });
  } catch (e) {
    console.error("Profession update error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
