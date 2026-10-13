export type SectionType = "overview" | "personality" | "love" | "career" | "money";
export type ScoreDimension = "personality" | "love" | "career" | "money";
export type ScopeType = "global" | "constellation" | "star";
export type RuleVersionStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type ReadingRequestMode = "preview" | "save";

export interface PreviewReadingRequest {
  birthDate: string;
  birthTimeLocal: string;
  birthTimeUnknown?: boolean;
  timezone?: string;
  dstFold?: 0 | 1;
  locationName: string;
  latitude: number;
  longitude: number;
}

export interface AstronomyMeta {
  sourceLabel?: string;
  catalogVersion?: string;
  engineName?: string;
}

export interface SelectedStar {
  id: number;
  displayName: string;
  magnitude: number;
}

export interface SelectedConstellation {
  id?: number;
  code: string;
  nameKo: string;
  nameEn?: string;
}

export interface ReadingMetrics {
  zenithDistanceDeg: number;
  altitudeDeg: number;
  azimuthDeg: number;
}

export interface AstroResult {
  selectedStar: SelectedStar;
  selectedConstellation: SelectedConstellation;
  metrics: ReadingMetrics;
  astronomyMeta?: AstronomyMeta;
}

export interface RuleVersion {
  id: string;
  versionCode: string;
  status: RuleVersionStatus;
  publishedAt?: string | null;
  note?: string | null;
}

export type RuleTemplates = Partial<Record<SectionType, string>>;

export interface InterpretationRule {
  id: string;
  ruleVersionId: string;
  scopeType: ScopeType;
  constellationId?: number | null;
  constellationCode?: string | null;
  starId?: number | null;
  priority: number;
  keywords?: string[];
  templates: RuleTemplates;
}

export interface ReadingSection {
  type: SectionType;
  title: string;
  content: string;
  sortOrder: number;
  sourceRuleId?: string | null;
  sourceScope?: ScopeType | "default";
}

export interface ReadingScore {
  dimension: ScoreDimension;
  score: number;
  grade: string;
}

export interface PreviewReadingResult extends AstroResult {
  readingId?: string;
  ruleVersionId: string;
  summary: string;
  sections: ReadingSection[];
  scores: ReadingScore[];
  matchedRuleIds: string[];
}

export interface TemplateContext {
  starId: string;
  starName: string;
  magnitude: string;
  constellationId: string;
  constellationCode: string;
  constellationNameKo: string;
  constellationNameEn: string;
  altitudeDeg: string;
  azimuthDeg: string;
  zenithDistanceDeg: string;
  brightnessTier: string;
  focusKeywords: string;
  sourceLabel: string;
  catalogVersion: string;
  engineName: string;
}
