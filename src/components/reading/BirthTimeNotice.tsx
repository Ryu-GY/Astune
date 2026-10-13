import { UNKNOWN_BIRTH_TIME_WARNING } from "@/lib/readings/birth-time";
import styles from "./BirthTimeNotice.module.css";

export function BirthTimeNotice() {
  return <aside className={styles.notice} aria-label="출생 시간 모름 안내">
    <strong>시간 모름 · 정확한 출생 리딩이 아니에요</strong>
    <p>{UNKNOWN_BIRTH_TIME_WARNING}</p>
  </aside>;
}
