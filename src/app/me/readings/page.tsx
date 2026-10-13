import { AccountReadings } from "@/components/reading/AccountReadings";

export default function MyReadingsPage() {
  return <section>
    <header className="collection-heading"><p className="eyebrow">MY STAR JOURNAL</p><h1>내가 간직한 별의 이야기</h1></header>
    <AccountReadings />
  </section>;
}
