import Image from "next/image";
import { Icon } from "@/components/ui/Icon";
export function StarFeature() {
  return <aside className="star-feature" aria-labelledby="example-star-title">
    <div className="feature-topline"><span className="rule-label">리딩 예시</span><span>1995.05.05 · 15:00 · 서울</span></div>
    <div className="celestial-art">
      <span className="compass north" aria-hidden="true">N</span><span className="compass east" aria-hidden="true">E</span><span className="compass west" aria-hidden="true">W</span><span className="compass south" aria-hidden="true">S</span>
      <Image src="/images/celestial-atlas.png" alt="금빛 별이 빛나는 고전적인 마차부자리 삽화" width={1024} height={1024} sizes="(max-width: 700px) 260px, (max-width: 1100px) 38vw, 420px" loading="eager" />
      <Icon name="star" className="orbit-star" />
    </div>
    <div className="star-caption"><p className="eyebrow">YOUR BIRTH STAR</p><h2 id="example-star-title">Capella</h2><p className="star-korean"><span />카펠라 <i>·</i> 마차부자리<span /></p><div className="keyword-list"><span>균형</span><span>직관</span></div><p className="star-footnote">그날, 당신의 하늘 가장 높은 곳에서.</p></div>
    <span className="margin-note" aria-hidden="true">DIFFERENT PEOPLE<br />SAME STARS</span>
  </aside>;
}
