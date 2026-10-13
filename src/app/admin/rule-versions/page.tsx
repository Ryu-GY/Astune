import { RuleManager } from "@/components/admin/RuleManager";
export default function AdminRuleVersionsPage() {
  return <section><span className="badge">Admin</span><h1 className="section-title">규칙 버전 관리</h1><p className="help">초안의 해석 문구를 작성하고 검토한 뒤 게시하세요. 게시된 버전과 변경 이력은 보존됩니다.</p><RuleManager /></section>;
}
