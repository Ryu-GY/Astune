import { AccountAccess } from "@/components/auth/AccountAccess";
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const query = await searchParams;
  const callbackURL = ["/account", "/me/readings", "/readings/preview", "/admin/rule-versions", "/horoscope"].includes(query.next || "") ? query.next! : "/account";
  return <section className="login-page">
    <p className="eyebrow">YOUR STAR, ALWAYS WITH YOU</p>
    <h1 className="section-title">나의 별 이야기를 이어가세요</h1>
    <p>Google 계정에 리딩을 보관하고, 저장한 출생 정보로 다시 찾아보세요.</p>
    {query.error ? <p className="error" role="alert">Google 로그인을 완료하지 못했어요. 다시 시도하거나 게스트로 시작해 주세요.</p> : null}
    <AccountAccess callbackURL={callbackURL} />
    <p className="help">게스트도 모든 해석을 무료로 볼 수 있어요.<br />게스트의 리딩과 출생 정보는 저장되지 않아요.<br />보관하려면 Google 계정으로 로그인해 주세요.</p>
  </section>;
}
