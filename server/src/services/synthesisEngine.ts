// SWOT → TOWS strategy synthesis. Phase 4 ships the signature; the
// AI-augmented version lives in Phase 7.

export interface SWOTInput {
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
}

export interface TOWSStrategies {
  SO: string[]; // leverage strengths to capture opportunities
  WO: string[]; // shore up weaknesses to capture opportunities
  ST: string[]; // use strengths to neutralize threats
  WT: string[]; // minimize weaknesses to avoid threats
}

export function generateTOWSStrategies(input: SWOTInput): TOWSStrategies {
  const cap = (a: string, b: string) => `${a} → ${b}`;
  return {
    SO: input.strengths.flatMap((s) => input.opportunities.map((o) => cap(s, o))),
    WO: input.weaknesses.flatMap((w) => input.opportunities.map((o) => cap(w, o))),
    ST: input.strengths.flatMap((s) => input.threats.map((t) => cap(s, t))),
    WT: input.weaknesses.flatMap((w) => input.threats.map((t) => cap(w, t))),
  };
}
