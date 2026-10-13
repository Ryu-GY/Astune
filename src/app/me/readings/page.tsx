export default function MyReadingsPage() {
  return (
    <section className="grid" style={{ gap: 20 }}>
      <div>
        <span className="badge">My Readings</span>
        <h1 className="section-title" style={{ marginTop: 12 }}>
          저장된 리딩
        </h1>
        <p className="help">
          이 스타터에서는 API만 먼저 준비했습니다. 정식 인증을 붙인 뒤
          <code> /api/v1/me/readings </code>와 연결하면 됩니다.
        </p>
      </div>

      <div className="card stack">
        <h2 style={{ margin: 0 }}>개발용 호출 예시</h2>
        <pre>{`curl -H "x-user-id: demo-user" \
  -H "x-user-email: user@astune.local" \
  http://localhost:3000/api/v1/me/readings`}</pre>
      </div>
    </section>
  );
}
