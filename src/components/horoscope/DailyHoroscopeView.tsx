"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth/client";
import { apiClient, ApiClientError, postJson } from "@/lib/utils/api-client";
import { SavedBirthProfilePicker } from "@/components/forms/SavedBirthProfilePicker";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import type { BirthProfile } from "@/types/birth-profile";
import type { DailyHoroscope } from "@/types/horoscope";
import styles from "./DailyHoroscopeView.module.css";

function koreanToday() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function DailyHoroscopeView() {
  const { data: session, isPending } = authClient.useSession();
  if (isPending) return <p className="help" role="status">오늘의 운세를 준비하고 있어요.</p>;
  // Account changes must not leave the previous person's birth date on screen.
  return <HoroscopeExperience key={session?.user.id ?? "guest"} signedIn={!!session} />;
}

function HoroscopeExperience({ signedIn }: { signedIn: boolean }) {
  const [birthDate, setBirthDate] = useState("");
  const [profileLabel, setProfileLabel] = useState("");
  const [today, setToday] = useState("");
  const [result, setResult] = useState<DailyHoroscope | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef<AbortController | null>(null);
  const selectedDate = useRef("");
  const edited = useRef(false);

  const showFortune = useCallback(async (date: string) => {
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    selectedDate.current = date;
    setLoading(true); setError(""); setResult(null);
    try {
      const data = await apiClient<{ horoscope: DailyHoroscope }>("/api/v1/horoscopes/daily", {
        ...postJson({ birthDate: date }), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]),
      });
      if (controller.signal.aborted) return;
      setResult(data.horoscope); setToday(data.horoscope.date);
    } catch (caught) {
      if (!controller.signal.aborted) setError(caught instanceof ApiClientError ? caught.message : "운세를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      if (pending.current === controller) { pending.current = null; setLoading(false); }
    }
  }, []);

  const useProfile = useCallback((profile: BirthProfile, source?: "initial" | "manual") => {
    // A late profile response must never overwrite a birth date the user typed.
    if (source === "initial" && edited.current) return;
    edited.current = true;
    const date = profile.input.birthAtLocal.split("T")[0];
    setBirthDate(date); setProfileLabel(profile.label);
    void showFortune(date);
  }, [showFortune]);

  useEffect(() => {
    setToday(koreanToday());
    return () => { pending.current?.abort(); pending.current = null; };
  }, []);

  useEffect(() => {
    if (!result) return;
    const refreshIfNeeded = () => {
      const date = koreanToday();
      setToday(date);
      if (document.visibilityState === "visible" && date !== result.date && selectedDate.current && !pending.current) {
        void showFortune(selectedDate.current);
      }
    };
    // Refresh at Korean midnight, and after a sleeping/background tab is reopened.
    const timeout = window.setTimeout(refreshIfNeeded, Math.max(1000, Date.parse(result.refreshAt) - Date.now() + 1000));
    document.addEventListener("visibilitychange", refreshIfNeeded);
    window.addEventListener("focus", refreshIfNeeded);
    return () => { window.clearTimeout(timeout); document.removeEventListener("visibilitychange", refreshIfNeeded); window.removeEventListener("focus", refreshIfNeeded); };
  }, [result, showFortune]);

  function editDate(value: string) {
    edited.current = true;
    pending.current?.abort(); pending.current = null;
    selectedDate.current = "";
    setBirthDate(value); setProfileLabel(""); setResult(null); setError(""); setLoading(false);
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); edited.current = true;
    void showFortune(birthDate);
  }

  return <div className={styles.page}>
    <header className={styles.heading}>
      <p className="eyebrow">A LITTLE LIGHT FOR TODAY</p>
      <h1>오늘의 운세</h1>
      <p>당신의 별자리에서 찾는, 오늘을 위한 작은 힌트.</p>
    </header>
    <div className={styles.workspace}>
      <section className={styles.inputPanel} aria-label="운세를 위한 생년월일">
        <span className={styles.sectionNumber}>01 — YOUR BIRTHDAY</span>
        <h2>나의 별자리 찾기</h2>
        <p className={styles.intro}>생년월일만으로 오늘의 운세를 만나보세요.<br />출생 시간과 도시는 입력하지 않아도 돼요.</p>
        <SavedBirthProfilePicker autoSelectFirst onSelect={useProfile} disabled={loading} />
        {profileLabel ? <p className={styles.profileNote}>‘{profileLabel}’의 생년월일을 불러왔어요.</p> : null}
        <form onSubmit={submit} aria-busy={loading}>
          <label className="label" htmlFor="horoscope-birth-date">생년월일 <span className="optional">양력</span></label>
          <input id="horoscope-birth-date" className="input" type="date" required max={today || undefined} value={birthDate} onChange={event => editDate(event.target.value)} />
          <Button className={styles.submit} type="submit" busy={loading} disabled={!birthDate}>{loading ? "오늘의 운세를 읽는 중…" : "오늘의 운세 보기"}<Icon name="arrow" /></Button>
        </form>
        {!signedIn ? <p className={styles.profileNote}><Link href="/login?next=/horoscope">로그인</Link>하면 내 정보에 저장한 생년월일을 바로 사용할 수 있어요.</p> : null}
        {error ? <p className="error" role="alert">{error}</p> : null}
        <div className={styles.basis}><Icon name="sun" /><p>양력 생일의 월·일로 구분하는 12별자리 기준이에요. 별 찾기의 출생 순간 대표 별과는 기준이 달라요.</p></div>
      </section>
      <section className={styles.resultPanel} aria-label="오늘의 별자리 운세" aria-busy={loading}>
        {loading ? <div className={styles.empty} role="status"><Icon name="sun" /><h2>오늘의 이야기를 준비하고 있어요.</h2><p>잠시만 기다려 주세요.</p></div>
          : result ? <FortuneResult result={result} />
          : <div className={styles.empty}><span className={styles.emptyOrbit} aria-hidden="true">☼</span><p className="eyebrow">YOUR DAILY HOROSCOPE</p><h2>오늘은 어떤 하루가<br />당신을 기다릴까요?</h2><p>생년월일을 입력하면 별자리와 함께<br />종합 · 연애 · 일 · 금전 운세를 보여드려요.</p></div>}
      </section>
    </div>
    <p className="sr-only" role="status">{result ? `${result.date} ${result.sign.name}의 오늘의 운세를 불러왔어요.` : ""}</p>
    <p className={styles.disclaimer}>생일 기준의 별자리와 날짜에 맞춰 전하는 Astune의 상징적 운세입니다. 한국 시간 자정에 새로운 이야기로 바뀝니다.</p>
  </div>;
}

function FortuneResult({ result }: { result: DailyHoroscope }) {
  const [year, month, day] = result.date.split("-");
  return <article className={styles.fortune}>
    <div className={styles.topline}><time dateTime={result.date}>{year}년 {Number(month)}월 {Number(day)}일</time><span>한국 시간 기준</span></div>
    <div className={styles.sign}>
      <span className={styles.glyph} aria-hidden="true">{result.sign.symbol}︎</span>
      <div><p className="eyebrow">{result.sign.englishName}</p><h2>{result.sign.name}</h2><p>{result.sign.dateRange} <span>· {result.sign.element}의 별자리</span></p></div>
    </div>
    <section className={styles.overview} aria-label="종합 운세">
      <span className={styles.keyword}>오늘의 키워드 · {result.keyword}</span>
      <h3>{result.title}</h3><p>{result.summary}</p>
    </section>
    <div className={styles.stories}>{result.sections.map(section => <section key={section.id}>
      <h3><Icon name={section.id === "love" ? "heart" : section.id === "work" ? "work" : "coins"} />{section.title}</h3><p>{section.body}</p>
    </section>)}</div>
    <aside className={styles.action}><span>오늘의 작은 실천</span><p>{result.action}</p></aside>
    <dl className={styles.lucky}>
      <div><dt>행운의 색</dt><dd><span className={styles.swatch} style={{ background: result.lucky.colorHex }} aria-hidden="true" />{result.lucky.color}</dd></div>
      <div><dt>행운의 숫자</dt><dd>{result.lucky.number}</dd></div>
    </dl>
  </article>;
}
