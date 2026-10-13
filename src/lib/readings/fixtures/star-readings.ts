import { STAR_PORTRAITS_A } from "./star-portraits-a";
import { STAR_PORTRAITS_B } from "./star-portraits-b";
import { STAR_PORTRAITS_C } from "./star-portraits-c";
import { EXPANDED_PORTRAITS_A } from "./star-portraits-expanded-a";
import { EXPANDED_PORTRAITS_B } from "./star-portraits-expanded-b";
import { EXPANDED_PORTRAITS_C } from "./star-portraits-expanded-c";
import { EXPANDED_PORTRAITS_D } from "./star-portraits-expanded-d";
import { portraitTemplates } from "./star-portrait";
import { CAPELLA_READING } from "./capella";
import { BETELGEUSE_READING } from "./betelgeuse";
import type { RuleTemplates } from "../types";

export type StarReading = { hipId: number; keywords: string[]; templates: Required<RuleTemplates> };

export const STAR_READINGS: StarReading[] = [
  { hipId: 24608, keywords: ["책임감", "생활력", "배려"], templates: CAPELLA_READING },
  { hipId: 27989, keywords: ["추진력", "표현력", "몰입"], templates: BETELGEUSE_READING },
  ...[
    ...STAR_PORTRAITS_A, ...STAR_PORTRAITS_B, ...STAR_PORTRAITS_C,
    ...EXPANDED_PORTRAITS_A, ...EXPANDED_PORTRAITS_B, ...EXPANDED_PORTRAITS_C, ...EXPANDED_PORTRAITS_D,
  ].map(portrait => ({ hipId: portrait.hipId, keywords: portrait.keywords, templates: portraitTemplates(portrait) })),
];
