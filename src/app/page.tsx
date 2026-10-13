export default function HomePage() {
  return (
    <section className="hero">
      <span className="badge">Astune · 출생 시각의 천정성 리딩</span>
      <h1>태어난 순간의 하늘에서 가장 높았던 별을 찾습니다.</h1>
      <p>
        Astune은 출생 장소와 출생 시각을 기준으로 천정에 가장 가까운 별을 계산하고,
        그 별의 성좌와 밝기를 바탕으로 성향, 연애, 일, 재물에 대한 리딩을 생성합니다.
      </p>

      <div className="grid grid-2">
        <article className="card stack">
          <h2 className="section-title">바로 해보기</h2>
          <p className="help">
            미리보기는 DB 저장 없이 바로 결과를 확인할 수 있습니다.
          </p>
          <a className="button" href="/readings/preview">
            리딩 미리보기 열기
          </a>
        </article>

        <article className="card stack">
          <h2 className="section-title">개발 포인트</h2>
          <ul className="help">
            <li>무료 구조: 정적 bright subset + 서버 내부 계산</li>
            <li>지오코딩: 로컬 좌표 사전 + 직접 좌표 입력 fallback</li>
            <li>권한: role 기반 관리자 API 가드</li>
            <li>저장: Prisma + SQLite 스타터</li>
          </ul>
        </article>
      </div>
    </section>
  );
}
