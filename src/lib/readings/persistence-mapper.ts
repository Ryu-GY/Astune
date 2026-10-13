import type { PreviewReadingResult, PreviewReadingRequest, ReadingRequestMode } from "./types";

export interface ReadingRowInsert {
  userId?: string | null;
  birthProfileId?: string | null;
  ruleVersionId: string;
  selectedStarId: number;
  selectedConstellationId?: number | null;
  engineName?: string | null;
  catalogVersion?: string | null;
  astroSourceLabel?: string | null;
  requestMode: ReadingRequestMode;
  status: "SUCCESS";
  inputSnapshotJson: unknown;
  zenithDistanceDeg: number;
  altitudeDeg: number;
  azimuthDeg: number;
  summaryText: string;
  generatedAt: string;
}

export interface ReportSectionRowInsert {
  sectionType: string;
  title: string;
  contentText: string;
  sortOrder: number;
}

export interface ReportScoreRowInsert {
  dimension: string;
  score: number;
  gradeLabel: string;
}

export interface PersistedReadingRows {
  reading: ReadingRowInsert;
  sections: ReportSectionRowInsert[];
  scores: ReportScoreRowInsert[];
}

export interface ToPersistenceRowsParams {
  userId?: string | null;
  birthProfileId?: string | null;
  requestMode: ReadingRequestMode;
  input: PreviewReadingRequest;
  result: PreviewReadingResult;
  generatedAt?: Date;
}

export function toPersistenceRows(params: ToPersistenceRowsParams): PersistedReadingRows {
  const generatedAt = (params.generatedAt ?? new Date()).toISOString();

  return {
    reading: {
      userId: params.userId ?? null,
      birthProfileId: params.birthProfileId ?? null,
      ruleVersionId: params.result.ruleVersionId,
      selectedStarId: params.result.selectedStar.id,
      selectedConstellationId: params.result.selectedConstellation.id ?? null,
      engineName: params.result.astronomyMeta?.engineName ?? null,
      catalogVersion: params.result.astronomyMeta?.catalogVersion ?? null,
      astroSourceLabel: params.result.astronomyMeta?.sourceLabel ?? null,
      requestMode: params.requestMode,
      status: "SUCCESS",
      inputSnapshotJson: params.input,
      zenithDistanceDeg: params.result.metrics.zenithDistanceDeg,
      altitudeDeg: params.result.metrics.altitudeDeg,
      azimuthDeg: params.result.metrics.azimuthDeg,
      summaryText: params.result.summary,
      generatedAt,
    },
    sections: params.result.sections.map((section) => ({
      sectionType: section.type,
      title: section.title,
      contentText: section.content,
      sortOrder: section.sortOrder,
    })),
    scores: params.result.scores.map((score) => ({
      dimension: score.dimension,
      score: score.score,
      gradeLabel: score.grade,
    })),
  };
}
