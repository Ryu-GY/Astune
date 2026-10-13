import type { ReadingPreviewResponse } from "@/types/reading";

export function ReadingCard({ data }: { data: ReadingPreviewResponse }) {
  return (
    <article className="card stack">
      <div className="badge">
        {data.astronomyMeta.sourceLabel} · {data.astronomyMeta.engineName}
      </div>

      <div>
        <h2 className="section-title" style={{ marginBottom: 8 }}>
          {data.reading.title}
        </h2>
        <p className="help">{data.reading.summary}</p>
      </div>

      <dl className="kv">
        <dt>대표 별</dt>
        <dd>
          {data.zenithStar.name} (HIP {data.zenithStar.hipId})
        </dd>

        <dt>성좌</dt>
        <dd>
          {data.zenithStar.constellationName} ({data.zenithStar.constellationCode})
        </dd>

        <dt>고도</dt>
        <dd>{data.zenithStar.altitudeDeg.toFixed(2)}°</dd>

        <dt>천정 거리</dt>
        <dd>{data.zenithStar.zenithDistanceDeg.toFixed(2)}°</dd>

        <dt>밝기 등급</dt>
        <dd>{data.zenithStar.magnitude}</dd>

        <dt>출생 장소</dt>
        <dd>{data.input.locationName || `${data.input.latitude}, ${data.input.longitude}`}</dd>

        <dt>현지 시각</dt>
        <dd>{data.input.birthAtLocal} ({data.input.timezone})</dd>

        <dt>UTC</dt>
        <dd>{data.astronomyMeta.calculatedAtUtc}</dd>
      </dl>

      <div>
        <h3 style={{ marginBottom: 8 }}>키워드</h3>
        <div className="grid">
          {data.reading.keywords.map((keyword) => (
            <span className="badge" key={keyword}>
              {keyword}
            </span>
          ))}
        </div>
      </div>

      <div className="grid" style={{ gap: 12 }}>
        <div>
          <strong>성향</strong>
          <p className="help">{data.interpretation.sections.find(section => section.type === "personality")?.content}</p>
        </div>
        <div>
          <strong>연애</strong>
          <p className="help">{data.reading.love}</p>
        </div>
        <div>
          <strong>일</strong>
          <p className="help">{data.reading.career}</p>
        </div>
        <div>
          <strong>재물</strong>
          <p className="help">{data.reading.money}</p>
        </div>
      </div>
      <div>
        <h3>해석 점수</h3>
        <p className="help">별의 위치·밝기와 규칙을 조합한 상징적 지표입니다.</p>
        <dl className="kv">
          {data.interpretation.scores.map(score => (
            <div key={score.dimension}>
              <dt>{{ personality: "성향", love: "연애", career: "일", money: "재물" }[score.dimension]}</dt>
              <dd>{score.score} / 100 · {score.grade}</dd>
            </div>
          ))}
        </dl>
      </div>
    </article>
  );
}
