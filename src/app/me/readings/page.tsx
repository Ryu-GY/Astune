import { SavedReadings } from "@/components/reading/SavedReadings";

export default function MyReadingsPage() {
  return <section>
    <header className="collection-heading"><p className="eyebrow">MY STAR JOURNAL</p><h1>내가 간직한 별의 이야기</h1><p>다시 꺼내 읽고 싶은 순간들을 이곳에.<br />리딩은 현재 사용 중인 브라우저에 보관됩니다.</p></header>
    <SavedReadings />
  </section>;
}
