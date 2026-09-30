// クイズ画面（遊ぶ・勉強・早押し）で共通の見た目
export const STAGE_BG = 'bg-[radial-gradient(ellipse_at_top,#4338ca_0%,#1e1b4b_55%,#0c0a24_100%)]'
export const CHOICE_STYLES = ['bg-rose-500', 'bg-sky-500', 'bg-amber-500', 'bg-emerald-500']
export const CHOICE_LABELS = ['A', 'B', 'C', 'D']

export function getNow() {
  return Date.now()
}

export function perfNow() {
  return performance.now()
}
