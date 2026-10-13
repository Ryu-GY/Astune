import type { PreviewReadingInput } from "./reading";
export type BirthProfile = { id: string; label: string; input: PreviewReadingInput };
export type BirthProfilePage = { items: BirthProfile[]; page: number; pageSize: number; total: number };
