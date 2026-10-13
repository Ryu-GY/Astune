import type { RuleTemplates, SectionType } from "../types";
import { explain, type Theme } from "./thematic-details";

export type StarPortrait = {
  hipId: number;
  keywords: string[];
  sections: Record<SectionType, [Theme, string]>;
};

export function portraitTemplates(portrait: StarPortrait): Required<RuleTemplates> {
  return Object.fromEntries(Object.entries(portrait.sections).map(([section, [theme, text]]) => [
    section, explain(theme, section as SectionType, section === "overview" ? `{starName}의 상징은 ${text}` : text),
  ])) as Required<RuleTemplates>;
}
