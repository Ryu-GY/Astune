"use client";
import { useEffect, useState } from "react";
import { apiClient, ApiClientError, postJson } from "@/lib/utils/api-client";
import { AccountAccess } from "@/components/auth/AccountAccess";
import { Pagination } from "@/components/reading/AccountReadings";
import { SECTION_TITLES } from "@/lib/readings/defaults";
import type { SectionType } from "@/lib/readings/types";
type Rule = { id: string; title: string; scopeType: "global" | "constellation" | "star"; constellationCode: string | null; starId: number | null; priority: number; keywordsCsv: string; generalText: string; personalityText: string; loveText: string; careerText: string; moneyText: string };
type Version = { id: string; name: string; status: "DRAFT" | "PUBLISHED" | "ARCHIVED"; rules: Rule[] };
type Audit = { id: string; action: string; createdAt: string; adminUser: { email: string }; changes: unknown };
const emptyTemplates = { overview: "", personality: "", love: "", career: "", money: "" };
export function RuleManager() {
  const [versions, setVersions] = useState<Version[]>([]);
  const [versionId, setVersionId] = useState("");
  const [ruleId, setRuleId] = useState("");
  const [versionName, setVersionName] = useState("");
  const [title, setTitle] = useState("");
  const [scope, setScope] = useState<Rule["scopeType"]>("global");
  const [target, setTarget] = useState("");
  const [priority, setPriority] = useState(100);
  const [keywords, setKeywords] = useState("");
  const [templates, setTemplates] = useState(emptyTemplates);
  const [logs, setLogs] = useState<{ items: Audit[]; total: number } | null>(null);
  const [logPage, setLogPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [publishConfirm, setPublishConfirm] = useState(false);
  const version = versions.find(item => item.id === versionId);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    Promise.all([
      apiClient<{ items: Version[] }>("/api/v1/admin/rule-versions", { signal: controller.signal }),
      apiClient<{ items: Audit[]; total: number }>(`/api/v1/admin/audit-logs?page=${logPage}&pageSize=10`, { signal: controller.signal }),
    ]).then(([data, audit]) => { setVersions(data.items); setLogs(audit); setDenied(false); })
      .catch(error => { if (!controller.signal.aborted) { setError(error instanceof Error ? error.message : "불러오기 실패"); setDenied(error instanceof ApiClientError && [401,403].includes(error.status)); } })
      .finally(() => { if (!controller.signal.aborted) setReady(true); });
    return () => controller.abort();
  }, [revision, logPage]);
  function editRule(rule?: Rule) {
    setRuleId(rule?.id || ""); setTitle(rule?.title || ""); setScope(rule?.scopeType || "global");
    setTarget(rule?.constellationCode || (rule?.starId ? String(rule.starId) : ""));
    setPriority(rule?.priority ?? 100); setKeywords(rule?.keywordsCsv || "");
    setTemplates(rule ? { overview: rule.generalText, personality: rule.personalityText, love: rule.loveText, career: rule.careerText, money: rule.moneyText } : emptyTemplates);
    setPublishConfirm(false);
  }
  async function action(work: () => Promise<void>) {
    setBusy(true); setError(""); setMessage("");
    try { await work(); setRevision(value => value + 1); }
    catch (error) { setError(error instanceof Error ? error.message : "요청 실패"); }
    finally { setBusy(false); }
  }
  async function newVersion(event: React.FormEvent) {
    event.preventDefault();
    await action(async () => {
      const result = await apiClient<{ ruleVersion: Version }>("/api/v1/admin/rule-versions", postJson({ name: versionName }));
      setVersionId(result.ruleVersion.id); setVersionName(""); editRule(); setMessage("새 초안을 만들었습니다.");
    });
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    await action(async () => {
      const url = `/api/v1/admin/rule-versions/${versionId}/rules${ruleId ? `/${ruleId}` : ""}`;
      const result = await apiClient<{ rule: Rule }>(url, { ...postJson({ title, scopeType: scope,
        constellationCode: scope === "constellation" ? target : null, starId: scope === "star" ? Number(target) : null,
        priority, keywords: keywords.split(",").map(word => word.trim()).filter(Boolean), templates }), method: ruleId ? "PUT" : "POST" });
      setRuleId(result.rule.id); setMessage("규칙과 변경 기록을 저장했습니다."); setPublishConfirm(false);
    });
  }
  if (!ready) return <p role="status">관리자 권한을 확인하는 중입니다.</p>;
  if (denied) return <><p className="error" role="alert">{error}</p><AccountAccess callbackURL="/admin/rule-versions" /><button className="text-button" onClick={() => setRevision(value => value + 1)}>권한 다시 확인</button></>;
  return <div className="admin-manager">
    {error ? <p role="alert" className="error">{error}</p> : null}<p role="status" className="help">{message}</p>
    <form className="stack card" onSubmit={newVersion}><label className="label">새 버전 이름<input className="input" required maxLength={120} value={versionName} onChange={event => setVersionName(event.target.value)} /></label><button className="button" disabled={busy}>빈 초안 만들기</button></form>
    <label className="label">작업할 버전<select className="select" value={versionId} onChange={event => { setVersionId(event.target.value); editRule(); }}><option value="">버전 선택</option>{versions.map(item => <option key={item.id} value={item.id}>{item.name} · {item.status}</option>)}</select></label>
    {version ? <section className="card stack"><h2 className="section-title">{version.name} <small>{version.status}</small></h2>
      <label className="label">규칙 선택<select className="select" value={ruleId} onChange={event => editRule(version.rules.find(rule => rule.id === event.target.value))}><option value="">새 규칙</option>{version.rules.map(rule => <option key={rule.id} value={rule.id}>{rule.title} · {rule.scopeType}</option>)}</select></label>
      <form onSubmit={save}><fieldset className="stack" disabled={busy || version.status !== "DRAFT"}>
        <label className="label">규칙 제목<input className="input" required maxLength={200} value={title} onChange={event => setTitle(event.target.value)} /></label>
        <div className="grid grid-2"><label className="label">적용 범위<select className="select" value={scope} onChange={event => { setScope(event.target.value as Rule["scopeType"]); setTarget(""); }}><option value="global">전체 공통</option><option value="constellation">성좌</option><option value="star">특정 별</option></select></label>{scope !== "global" ? <label className="label">{scope === "star" ? "HIP 별 ID" : "성좌 코드 (예: Aur)"}<input className="input" required value={target} onChange={event => setTarget(event.target.value)} /></label> : null}<label className="label">우선순위<input className="input" type="number" min={-32768} max={32767} required value={priority} onChange={event => setPriority(Number(event.target.value))} /></label><label className="label">키워드 (쉼표로 구분)<input className="input" value={keywords} onChange={event => setKeywords(event.target.value)} /></label></div>
        {(Object.keys(SECTION_TITLES) as SectionType[]).map(type => <label className="label" key={type}>{SECTION_TITLES[type]}<textarea rows={7} maxLength={4000} value={templates[type]} onChange={event => setTemplates({ ...templates, [type]: event.target.value })} /></label>)}
        <p className="help">문단 사이에 빈 줄을 넣을 수 있습니다. 변수 예: {"{starName}, {constellationNameKo}, {altitudeDeg}, {zenithDistanceDeg}"}. 빈 영역은 다른 규칙 또는 기본 해석을 사용합니다.</p>
        <button className="button" disabled={busy}>규칙 저장</button>
      </fieldset></form>
      {version.status === "DRAFT" ? <div className="stack"><p className="help">게시는 저장된 규칙에 적용됩니다. 새 버전을 게시하면 이전 게시 버전은 보관됩니다.</p>{publishConfirm ? <><p>‘{version.name}’을 게시하시겠습니까? 새 리딩부터 이 버전이 적용됩니다.</p><button className="button" disabled={busy} onClick={() => action(async () => { await apiClient(`/api/v1/admin/rule-versions/${version.id}/publish`, postJson({})); setPublishConfirm(false); setMessage("새 버전을 게시했습니다."); })}>게시 확정</button><button className="text-button" disabled={busy} onClick={() => setPublishConfirm(false)}>취소</button></> : <button className="button secondary" disabled={busy || !version.rules.length} onClick={() => setPublishConfirm(true)}>저장된 버전 게시하기</button>}</div> : <p className="help">게시·보관된 버전은 수정할 수 없습니다.</p>}
    </section> : null}
    <section className="audit-list"><h2 className="section-title">관리자 변경 기록</h2>{logs?.items.map(log => <details key={log.id}><summary>{new Date(log.createdAt).toLocaleString("ko-KR")} · {log.action} · {log.adminUser.email}</summary><pre>{JSON.stringify(log.changes, null, 2)}</pre></details>)}{logs ? <Pagination page={logPage} pageSize={10} total={logs.total} onChange={setLogPage} busy={busy} /> : null}</section>
  </div>;
}
