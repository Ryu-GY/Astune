export type CatalogStar = {
  hipId: number;
  name: string;
  constellationCode: string;
  constellationName: string;
  magnitude: number;
  raHours: number;
  decDegrees: number;
};

export type ZenithStarCandidate = {
  star: CatalogStar;
  altitudeDeg: number;
  azimuthDeg: number;
  zenithDistanceDeg: number;
};

export type ZenithComputationResult = {
  best: ZenithStarCandidate;
  candidateCount: number;
  calculatedAtUtc: string;
};
