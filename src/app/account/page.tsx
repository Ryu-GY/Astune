import { AccountBirthProfiles } from "@/components/account/AccountBirthProfiles";
export default function AccountPage() {
  return <section className="account-page">
    <header className="collection-heading"><p className="eyebrow">MY BIRTH DETAILS</p><h1>나의 출생 정보</h1><p>출생 정보를 저장하고, 별을 찾을 때 바로 불러오세요.</p></header>
    <AccountBirthProfiles />
  </section>;
}
