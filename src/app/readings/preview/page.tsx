import { PreviewReadingForm } from "@/components/forms/PreviewReadingForm";

export default function PreviewPage() {
  return (
    <section className="grid" style={{ gap: 24 }}>
      <div>
        <span className="badge">Preview API</span>
        <h1 className="section-title" style={{ marginTop: 12 }}>
          출생 정보로 천정성을 계산해 보세요
        </h1>
        <p className="help">
          기본 코드는 무료 구조를 유지하기 위해 외부 천문 API를 호출하지 않고,
          프로젝트 내부의 bright subset 카탈로그와 계산 로직으로 결과를 만듭니다.
        </p>
      </div>
      <PreviewReadingForm />
    </section>
  );
}
