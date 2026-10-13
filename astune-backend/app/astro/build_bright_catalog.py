from __future__ import annotations

import csv
import json
from pathlib import Path


def build_bright_catalog(
    *,
    input_csv_path: str,
    output_json_path: str,
    max_magnitude: float = 5.5,
) -> None:
    """
    정규화된 CSV 에서 bright subset JSON 을 만든다.

    입력 CSV 권장 컬럼:
    hip_id,name,ra_hours,dec_degrees,magnitude,constellation_code,constellation_name_ko,constellation_name_en
    """
    input_path = Path(input_csv_path)
    output_path = Path(output_json_path)

    rows: list[dict[str, object]] = []
    with input_path.open("r", encoding="utf-8") as fp:
        reader = csv.DictReader(fp)
        for row in reader:
            magnitude = float(row["magnitude"])
            if magnitude > max_magnitude:
                continue
            rows.append(
                {
                    "hip_id": int(row["hip_id"]),
                    "display_name": row.get("name") or f"HIP {row['hip_id']}",
                    "ra_hours": float(row["ra_hours"]),
                    "dec_degrees": float(row["dec_degrees"]),
                    "magnitude": magnitude,
                    "constellation_code": row.get("constellation_code") or row.get("constellation") or None,
                    "constellation_name_ko": row.get("constellation_name_ko") or None,
                    "constellation_name_en": row.get("constellation_name_en") or None,
                }
            )

    rows.sort(key=lambda item: (item["magnitude"], item["hip_id"]))
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(rows, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


if __name__ == "__main__":
    build_bright_catalog(
        input_csv_path="data/astro/hipparcos_normalized.csv",
        output_json_path="data/astro/bright_stars.json",
    )
