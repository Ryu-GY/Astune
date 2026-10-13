export default function AdminRuleVersionsPage() {
  return (
    <section className="grid" style={{ gap: 20 }}>
      <div>
        <span className="badge">Admin</span>
        <h1 className="section-title" style={{ marginTop: 12 }}>
          규칙 버전 관리
        </h1>
        <p className="help">
          관리자 API는 개발 환경에서 ASTUNE_ALLOW_DEV_AUTH=1일 때만 헤더 인증을 허용합니다.
          게시한 규칙을 사용하려면 ASTUNE_RULE_SOURCE=database로 설정하세요. 운영 인증은 별도 연결이 필요합니다.
        </p>
      </div>

      <div className="card stack">
        <h2 style={{ margin: 0 }}>개발용 관리자 헤더</h2>
        <pre>{`x-user-id: admin-user
x-user-email: admin@astune.local
x-user-role: ADMIN`}</pre>
      </div>
    </section>
  );
}
