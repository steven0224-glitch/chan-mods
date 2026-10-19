export type Lesson = { file: string; title: string; keys: string[] }
export type Index = { lessons: Lesson[]; idf: Map<string, number> }
export type Hit = { file: string; title: string; score: number; matched: string[] }

const STOP = new Set([
  'the', 'and', 'for', 'with', 'not', 'use', 'from', 'into', 'when', 'than', 'that', 'this', 'are', 'was', 'its', 'via', 'out', 'all', 'new', 'one', 'two',
  // Nearly every lesson in this harness is about Claude: no signal
  'claude', 'code',
  '그리고', '하는', '있는', '없는', '위해', '경우', '대신', '먼저', '이후', '기록', '적용', '때문', '사용', '확인', '문제', '방법', '해결', '진행', '작업', '이번', '다음',
])
const JOSA2 = ['에서', '으로', '부터', '까지', '처럼', '보다', '에게', '이랑', '하고', '해서', '하면', '했다', '한다']
const JOSA1 = ['은', '는', '이', '가', '을', '를', '의', '에', '도', '만', '로', '와', '과', '랑']
const HANGUL = /[가-힣]/

// Lowercase, split on anything that is not a letter or digit, strip Korean particles, drop short and stop words
export function tokens(text: string): string[] {
  const out: string[] = []
  for (let w of text.toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
    if (!w) continue
    if (HANGUL.test(w)) {
      const two = JOSA2.find(j => w.length >= 4 && w.endsWith(j))
      if (two) w = w.slice(0, -two.length)
      else if (w.length >= 3 && JOSA1.some(j => w.endsWith(j))) w = w.slice(0, -1)
      if (w.length < 2) continue
    } else if (w.length < 3 || /^\d+$/.test(w)) continue
    if (!STOP.has(w)) out.push(w)
  }
  return out
}

// One lesson: the slug without its date, and the first non-blank line as the title
export function lessonOf(file: string, text: string): Lesson {
  const first = text.split('\n').find(l => l.trim()) ?? ''
  const title = first.replace(/^#+\s*/, '').trim().slice(0, 120)
  const slug = file.replace(/\.md$/, '').replace(/^\d{4}-\d{2}-\d{2}-/, '')
  return { file, title, keys: [...new Set([...tokens(slug), ...tokens(title)])] }
}

export function buildIndex(lessons: Lesson[]): Index {
  const df = new Map<string, number>()
  for (const l of lessons) for (const k of l.keys) df.set(k, (df.get(k) ?? 0) + 1)
  const n = Math.max(2, lessons.length)
  // Rarity scaled to 0..1 by log n, so the thresholds below hold for 5 lessons as for 500
  const idf = new Map([...df].map(([k, d]) => [k, Math.log(n / d) / Math.log(n)] as [string, number]))
  return { lessons, idf }
}

// shortcut: plain token overlap weighted by rarity; a model-graded match would catch paraphrases, at a cost per prompt
export function recall(index: Index, prompt: string, limit = 3): Hit[] {
  const words = new Set(tokens(prompt))
  const flat = prompt.toLowerCase()
  const hits: Hit[] = []
  for (const l of index.lessons) {
    const matched = l.keys.filter(k => words.has(k) || (HANGUL.test(k) && k.length >= 3 && flat.includes(k)))
    const score = matched.reduce((s, k) => s + (index.idf.get(k) ?? 0), 0)
    // Two distinct shared words, or one rare long one, so a single common word never triggers
    const rareSolo = matched.length === 1 && matched[0].length >= 6 && (index.idf.get(matched[0]) ?? 0) >= 0.9
    if ((matched.length >= 2 && score >= 1.0) || rareSolo) hits.push({ file: l.file, title: l.title, score, matched })
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit)
}

export function contextOf(hits: Hit[]): string {
  return [
    '[lessons-recall] 이 프롬프트와 단어가 겹치는 교훈 파일 — 관련 있으면 작업 전에 읽을 것(무관하면 무시):',
    ...hits.map(h => `- ~/.claude/lessons/${h.file} — ${h.title}`),
  ].join('\n')
}
