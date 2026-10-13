import cities from "../../../data/locations/cities.json";
import { PreviewReadingForm } from "@/components/forms/PreviewReadingForm";
import { Icon, type IconName } from "@/components/ui/Icon";
const themes: { title: string; english: string; description: string; icon: IconName }[] = [
  { title: "성향", english: "YOUR NATURE", description: "나답게 빛나는 마음의 결", icon: "star" },
  { title: "연애", english: "LOVE & CONNECTION", description: "마음이 닿는 관계의 방식", icon: "heart" },
  { title: "일", english: "WORK & PURPOSE", description: "가능성이 자라는 나의 방향", icon: "work" },
  { title: "재물", english: "WEALTH & BALANCE", description: "일상을 채우는 균형의 감각", icon: "coins" },
];
export function ReadingExperience() {
  return <>
    <PreviewReadingForm cities={cities} />
    <section className="reading-themes" aria-label="별로 읽는 네 가지 이야기">{themes.map(theme => <div className="theme" key={theme.title}><div className="theme-heading"><Icon name={theme.icon} /><h2>{theme.title}</h2><span>{theme.english}</span></div><p>{theme.description}</p></div>)}</section>
    <section className="about-reading" aria-label="Astune 리딩 안내"><span className="eyebrow">A MOMENT WRITTEN IN THE STARS</span><p>태어난 순간의 하늘을 살펴보고,<br className="mobile-only" /> 나를 이해하는 작은 단서를 만나보세요.</p><span>별의 위치는 천문 계산으로, 해석은 상징적 이야기로 전합니다.</span></section>
  </>;
}
