// active: has a next step; held: next step starts with 대기 or says 보류;
// stale: active but untouched for STALE_DAYS; nonext: no 다음: line at all
export type WipKind = 'active' | 'held' | 'stale' | 'nonext'

export type WipItem = {
  file: string
  title: string
  next: string
  mtimeMs: number
  kind: WipKind
}

declare module 'claude-code' {
  interface PluginState {
    'wip-board': {
      items: WipItem[]
      isBandHidden: boolean
    }
  }
}
