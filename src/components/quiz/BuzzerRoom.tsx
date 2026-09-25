'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import type { Quiz } from '@/types'
import { shuffle, toQuiz } from '@/lib/quiz'
import { readLocalRoomQuizzes } from '@/lib/room'
import { INITIAL_ROOM_STATE, createHostEngine, type HostEngine, type RoomState } from '@/lib/buzzerEngine'
import { sfx, unlockSound } from '@/lib/sound'
import { btn, card, input } from '@/lib/ui'
import ProgressiveText from './ProgressiveText'
import { DifficultyBadge } from './Difficulty'

type Role = 'host' | 'player'
interface Member { id: string; name: string; role: Role; joinedAt: number }
interface Me { id: string; name: string }

const SPEEDS = { slow: { label: 'ゆっくり', ms: 170 }, normal: { label: 'ふつう', ms: 110 }, fast: { label: 'はやい', ms: 70 } } as const
type Speed = keyof typeof SPEEDS
const BUZZ_WINDOWS = [3000, 5000, 10000, 20000, null] as const
const ANSWER_LIMITS = [5000, 10000, 15000, 30000, null] as const
const limitLabel = (ms: number | null) => (ms === null ? '無制限' : `${ms / 1000}秒`)

export default function BuzzerRoom(props: { code: string; setId: string | null; local: boolean; wantsHost: boolean }) {
  const [me, setMe] = useState<Me | null>(null)
  if (!me) return <JoinScreen code={props.code} wantsHost={props.wantsHost} onJoin={setMe} />
  return <Room {...props} me={me} />
}

function JoinScreen({ code, wantsHost, onJoin }: { code: string; wantsHost: boolean; onJoin: (me: Me) => void }) {
  const [name, setName] = useState(() => localStorage.getItem('km:nickname') ?? '')

  function join() {
    const n = name.trim().slice(0, 20)
    if (!n) return
    localStorage.setItem('km:nickname', n)
    let id = sessionStorage.getItem('km:player-id')
    if (!id) {
      id = crypto.randomUUID()
      sessionStorage.setItem('km:player-id', id)
    }
    unlockSound()
    onJoin({ id, name: n })
  }

  return (
    <div className="mx-auto mt-10 max-w-sm">
      <div className={`${card} p-6 text-center`}>
        <div className="text-4xl">⚡</div>
        <h1 className="mt-2 text-xl font-bold">早押しクイズ</h1>
        <p className="mt-1 text-sm text-gray-500">ルーム <span className="font-mono font-bold tracking-widest text-gray-800">{code}</span></p>
        <div className="mt-6 flex flex-col gap-3 text-left">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-500">ニックネーム</span>
            <input autoFocus value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && join()}
              maxLength={20} placeholder="例：たろう" className={input} />
          </label>
          <button onClick={join} disabled={!name.trim()} className={`${btn.primary} py-3 text-base`}>
            {wantsHost ? 'ルームを開く' : '参加する'}
          </button>
        </div>
      </div>
    </div>
  )
}

async function loadPool(
  supabase: ReturnType<typeof createClient>,
  code: string,
  setId: string | null,
  local: boolean,
): Promise<{ title: string; quizzes: Quiz[] } | null> {
  if (local) return readLocalRoomQuizzes(code)
  if (!setId) return null
  const [{ data: set }, { data: rows }] = await Promise.all([
    supabase.from('quiz_sets').select('title').eq('id', setId).maybeSingle(),
    supabase.from('quiz_set_items').select('position, memos(id, question, answer, explanation, difficulty, tags)').eq('quiz_set_id', setId).order('position'),
  ])
  if (!set) return null
  const quizzes = (rows ?? [])
    .map(r => r.memos as unknown as Parameters<typeof toQuiz>[0] | null)
    .filter((m): m is Parameters<typeof toQuiz>[0] => !!m)
    .map(toQuiz)
  return { title: set.title, quizzes }
}

function Room({ code, setId, local, wantsHost, me }: { code: string; setId: string | null; local: boolean; wantsHost: boolean; me: Me }) {
  const [supabase] = useState(createClient)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const engineRef = useRef<HostEngine | null>(null)
  const membersRef = useRef<Member[]>([])
  const isHostRef = useRef(wantsHost)
  const viewRef = useRef<RoomState>(INITIAL_ROOM_STATE)

  const [status, setStatus] = useState<'connecting' | 'connected' | 'error'>('connecting')
  const [members, setMembers] = useState<Member[]>([])
  const [isHost, setIsHost] = useState(wantsHost)
  const [view, setView] = useState<RoomState>(INITIAL_ROOM_STATE)
  const [hostAnswer, setHostAnswer] = useState<string | null>(null)
  const [readStart, setReadStart] = useState<number | null>(null)
  const [buzzStart, setBuzzStart] = useState<number | null>(null)
  const [pressed, setPressed] = useState(false)
  const [answerText, setAnswerText] = useState('')
  const [copied, setCopied] = useState(false)

  const [pool, setPool] = useState<{ title: string; quizzes: Quiz[] } | null>(null)
  const [poolError, setPoolError] = useState<string | null>(null)
  const [random, setRandom] = useState(true)
  const [count, setCount] = useState(10)
  const [speed, setSpeed] = useState<Speed>('normal')
  const [buzzWindow, setBuzzWindow] = useState<number | null>(5000)
  const [answerLimit, setAnswerLimit] = useState<number | null>(15000)

  const apply = useCallback((next: RoomState) => {
    const prev = viewRef.current
    if (next.phase === 'reading' && (prev.phase !== 'reading' || prev.readSeq !== next.readSeq)) {
      setReadStart(performance.now())
      setPressed(false)
    }
    if (next.phase === 'buzzed' && prev.buzzSeq !== next.buzzSeq) {
      setBuzzStart(performance.now())
      setAnswerText('')
      sfx.buzz()
    }
    if (next.phase === 'judged' && prev.phase !== 'judged') {
      if (next.result?.correct) sfx.correct()
      else sfx.wrong()
    } else if (next.phase === 'reading' && next.result && !next.result.correct && prev.phase === 'buzzed') {
      sfx.wrong()
    }
    viewRef.current = next
    setView(next)
  }, [])

  // チャンネル接続・参加者の管理
  useEffect(() => {
    const joinedAt = Date.now()
    const channel = supabase.channel(`quiz-room:${code}`, {
      config: { broadcast: { self: false }, presence: { key: me.id } },
    })
    channelRef.current = channel

    const track = (role: Role) => channel.track({ id: me.id, name: me.name, role, joinedAt })

    channel
      .on('presence', { event: 'sync' }, () => {
        const seen = new Map<string, Member>()
        for (const metas of Object.values(channel.presenceState<Member>())) {
          for (const m of metas) if (!seen.has(m.id)) seen.set(m.id, { id: m.id, name: m.name, role: m.role, joinedAt: m.joinedAt })
        }
        const list = [...seen.values()].sort((a, b) => a.joinedAt - b.joinedAt)
        membersRef.current = list
        setMembers(list)

        // ホストが二重になったら、先に入った方だけをホストにする
        if (isHostRef.current) {
          const firstHost = list.find(m => m.role === 'host')
          if (firstHost && firstHost.id !== me.id) {
            isHostRef.current = false
            setIsHost(false)
            void track('player')
            channel.send({ type: 'broadcast', event: 'hello', payload: {} })
          }
        }
      })
      .on('presence', { event: 'join' }, () => engineRef.current?.resync())
      .on('broadcast', { event: 'state' }, ({ payload }) => {
        if (!isHostRef.current) apply(payload as RoomState)
      })
      .on('broadcast', { event: 'buzz' }, ({ payload }) => engineRef.current?.buzz(payload as { id: string; name: string }))
      .on('broadcast', { event: 'answer' }, ({ payload }) => engineRef.current?.answer(payload as { id: string; text: string }))
      .on('broadcast', { event: 'hello' }, () => engineRef.current?.resync())
      .subscribe(s => {
        if (s === 'SUBSCRIBED') {
          setStatus('connected')
          void track(isHostRef.current ? 'host' : 'player')
          if (!isHostRef.current) channel.send({ type: 'broadcast', event: 'hello', payload: {} })
        } else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') {
          setStatus('error')
        }
      })

    return () => {
      channelRef.current = null
      void supabase.removeChannel(channel)
    }
  }, [supabase, code, me.id, me.name, apply])

  // ホスト：問題の読み込み
  useEffect(() => {
    if (!isHost) return
    let cancelled = false
    loadPool(supabase, code, setId, local).then(res => {
      if (cancelled) return
      if (res && res.quizzes.length > 0) setPool(res)
      else setPoolError('問題を読み込めませんでした。セットが非公開か、削除された可能性があります。')
    })
    return () => { cancelled = true }
  }, [isHost, supabase, code, setId, local])

  // ホスト：進行エンジン
  useEffect(() => {
    if (!isHost || !pool) return
    const engine = createHostEngine({
      title: pool.title,
      apply: (s, answer) => { apply(s); setHostAnswer(answer) },
      send: s => { channelRef.current?.send({ type: 'broadcast', event: 'state', payload: s }) },
      activePlayerIds: () => membersRef.current.map(m => m.id),
    })
    engineRef.current = engine
    engine.resync()
    return () => { engine.dispose(); engineRef.current = null }
  }, [isHost, pool, apply])

  const canBuzz = view.phase === 'reading' && !view.lockedOut.includes(me.id) && !pressed

  const buzz = useCallback(() => {
    if (!canBuzz) return
    setPressed(true)
    const p = { id: me.id, name: me.name }
    if (isHostRef.current) engineRef.current?.buzz(p)
    else channelRef.current?.send({ type: 'broadcast', event: 'buzz', payload: p })
  }, [canBuzz, me.id, me.name])

  function submitAnswer() {
    const p = { id: me.id, text: answerText }
    if (isHostRef.current) engineRef.current?.answer(p)
    else channelRef.current?.send({ type: 'broadcast', event: 'answer', payload: p })
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.code !== 'Space') return
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return
      e.preventDefault()
      buzz()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [buzz])

  function startGame() {
    if (!pool) return
    const picked = random ? shuffle(pool.quizzes) : pool.quizzes
    engineRef.current?.start(
      count > 0 ? picked.slice(0, count) : picked,
      { charMs: SPEEDS[speed].ms, buzzWindowMs: buzzWindow, answerLimitMs: answerLimit },
      membersRef.current,
    )
  }

  async function copyInvite() {
    await navigator.clipboard.writeText(`${location.origin}/quiz/room/${code}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const hostMember = members.find(m => m.role === 'host')
  const title = view.title || pool?.title || ''
  const scoreboard = members
    .map(m => ({ ...m, score: view.scores[m.id]?.score ?? 0 }))
    .concat(
      Object.entries(view.scores)
        .filter(([id]) => !members.some(m => m.id === id))
        .map(([id, s]) => ({ id, name: `${s.name}（退出）`, role: 'player' as Role, joinedAt: 0, score: s.score })),
    )
    .sort((a, b) => b.score - a.score)
  const iAmBuzzer = view.buzzer?.id === me.id

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_260px]">
      <div className="flex min-w-0 flex-col gap-4">
        {/* ルーム情報 */}
        <div className={`${card} flex flex-wrap items-center gap-3 p-4`}>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-rose-600">⚡ 早押しルーム</div>
            <div className="truncate text-lg font-bold">{title || '読み込み中…'}</div>
          </div>
          <div className="text-right">
            <div className="text-[11px] text-gray-400">ルームコード</div>
            <div className="font-mono text-xl font-bold tracking-[0.2em]">{code}</div>
          </div>
          <button onClick={copyInvite} className={btn.secondary}>{copied ? '✓ コピーしました' : '🔗 招待リンクをコピー'}</button>
        </div>

        {status === 'error' && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">接続できませんでした。ページを再読み込みしてください。</div>
        )}

        {/* ロビー */}
        {view.phase === 'lobby' && (
          <div className={`${card} flex flex-col gap-5 p-6`}>
            {isHost ? (
              poolError ? (
                <p className="text-sm text-red-500">{poolError}</p>
              ) : !pool ? (
                <p className="text-sm text-gray-500">問題を読み込んでいます…</p>
              ) : (
                <>
                  <div>
                    <div className="text-sm font-semibold">あなたがホストです</div>
                    <p className="mt-0.5 text-xs text-gray-500">招待リンクを送って、みんなが揃ったらスタートしましょう。ホストも一緒に早押しできます。</p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Setting label="問題数">
                      {[5, 10, 20, 0].filter(n => n === 0 || n < pool.quizzes.length).map(n => (
                        <Opt key={n} active={(count > 0 && count < pool.quizzes.length ? count : 0) === n} onClick={() => setCount(n)}>
                          {n === 0 ? `全部(${pool.quizzes.length})` : `${n}問`}
                        </Opt>
                      ))}
                    </Setting>
                    <Setting label="出題順">
                      <Opt active={random} onClick={() => setRandom(true)}>ランダム</Opt>
                      <Opt active={!random} onClick={() => setRandom(false)}>そのまま</Opt>
                    </Setting>
                    <Setting label="表示スピード">
                      {(Object.keys(SPEEDS) as Speed[]).map(s => (
                        <Opt key={s} active={speed === s} onClick={() => setSpeed(s)}>{SPEEDS[s].label}</Opt>
                      ))}
                    </Setting>
                    <Setting label="押せる時間（問題文が出きってから）">
                      {BUZZ_WINDOWS.map(ms => (
                        <Opt key={String(ms)} active={buzzWindow === ms} onClick={() => setBuzzWindow(ms)}>{limitLabel(ms)}</Opt>
                      ))}
                    </Setting>
                    <Setting label="回答時間（押してから）">
                      {ANSWER_LIMITS.map(ms => (
                        <Opt key={String(ms)} active={answerLimit === ms} onClick={() => setAnswerLimit(ms)}>{limitLabel(ms)}</Opt>
                      ))}
                    </Setting>
                  </div>
                  <button onClick={startGame} disabled={status !== 'connected'} className={`${btn.primary} py-3 text-base`}>
                    スタート（{members.length}人）
                  </button>
                </>
              )
            ) : (
              <div className="py-6 text-center">
                <div className="text-3xl">⏳</div>
                <p className="mt-2 text-sm text-gray-600">
                  {hostMember ? `${hostMember.name}さんがスタートするのを待っています…` : 'ホストがまだ来ていません…'}
                </p>
                <p className="mt-1 text-xs text-gray-400">問題文が少しずつ表示されます。わかったら「押す！」（スペースキー）</p>
              </div>
            )}
          </div>
        )}

        {/* 出題中 */}
        {(view.phase === 'reading' || view.phase === 'buzzed' || view.phase === 'judged') && (
          <div className={`${card} overflow-hidden`}>
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-2.5">
              <span className="text-sm font-bold text-gray-700">第{view.index + 1}問 <span className="font-normal text-gray-400">/ {view.total}</span></span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">⏱ 押せる {limitLabel(view.buzzWindowMs)} ・ 回答 {limitLabel(view.answerLimitMs)}</span>
                <DifficultyBadge level={view.difficulty} />
              </div>
            </div>

            <div className="min-h-[140px] px-6 py-6">
              <div className="flex gap-2 text-xl leading-relaxed">
                <span className="font-bold text-indigo-600">Q.</span>
                <ProgressiveText
                  key={view.readSeq}
                  text={view.question}
                  from={view.readFrom}
                  startedAt={view.phase === 'reading' ? readStart : null}
                  charMs={view.charMs}
                  stopped={view.phase === 'reading' ? null : view.paused ?? view.readFrom}
                  className="flex-1 font-medium"
                />
              </div>
            </div>

            {view.phase === 'reading' && view.result && !view.result.correct && (
              <div className="mx-5 mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
                ✗ {view.result.name}さん 不正解{view.result.answerText && `（${view.result.answerText}）`} — 続きから再開！
              </div>
            )}

            <div className="flex flex-col gap-3 border-t border-gray-100 p-4">
              {view.phase === 'reading' && view.buzzWindowMs !== null && (
                <TimeBar
                  key={view.readSeq}
                  startAt={readStart === null ? null : readStart + Math.max(0, view.question.length - view.readFrom) * view.charMs}
                  totalMs={view.buzzWindowMs}
                  pendingLabel={`問題文を表示中… 出きってから${limitLabel(view.buzzWindowMs)}押せます`}
                  label="押せるのは"
                />
              )}
              {view.phase === 'reading' && (
                view.lockedOut.includes(me.id) ? (
                  <div className="rounded-xl bg-gray-100 py-4 text-center text-sm text-gray-500">お手つき中（この問題は押せません）</div>
                ) : (
                  <button onClick={buzz} disabled={!canBuzz}
                    className="w-full rounded-2xl bg-rose-500 py-6 text-2xl font-black text-white shadow-lg transition-transform hover:bg-rose-600 active:scale-[0.97] disabled:opacity-60">
                    {pressed ? '押した！' : '押す！'} <span className="ml-1 text-sm font-normal opacity-80">Space</span>
                  </button>
                )
              )}

              {view.phase === 'buzzed' && view.buzzer && (
                <div className="flex flex-col gap-3">
                  <div className="text-lg font-bold text-rose-600">🔔 {iAmBuzzer ? 'あなた' : `${view.buzzer.name}さん`}が押しました！</div>
                  {view.buzzAnswer === null && view.answerLimitMs !== null && (
                    <TimeBar key={view.buzzSeq} startAt={buzzStart} totalMs={view.answerLimitMs} label="回答時間" urgentTone />
                  )}

                  {iAmBuzzer && view.buzzAnswer === null && (
                    <div className="flex gap-2">
                      <input autoFocus value={answerText} onChange={e => setAnswerText(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) submitAnswer() }}
                        placeholder="答えを入力して Enter" className={`${input} py-3 text-lg`} />
                      <button onClick={submitAnswer} className={btn.primary}>回答</button>
                    </div>
                  )}

                  {view.buzzAnswer !== null && (
                    <div className="rounded-lg bg-gray-50 px-4 py-3">
                      <div className="text-xs text-gray-500">{view.buzzer.name}さんの回答</div>
                      <div className="text-lg font-semibold">{view.buzzAnswer}</div>
                      {!isHost && <div className="mt-1 text-xs text-gray-400">ホストが判定中…</div>}
                    </div>
                  )}

                  {isHost && view.buzzAnswer !== null && (
                    <div className="flex flex-col gap-2 rounded-lg border border-indigo-200 bg-indigo-50/50 p-3">
                      <div className="text-xs text-gray-500">ホスト判定 ─ 正解は <b className="text-gray-900">{hostAnswer}</b></div>
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => engineRef.current?.judge(false)} className="rounded-lg border-2 border-rose-200 py-2 font-semibold text-rose-600 hover:bg-rose-50">✗ 不正解</button>
                        <button onClick={() => engineRef.current?.judge(true)} className="rounded-lg border-2 border-emerald-300 py-2 font-semibold text-emerald-700 hover:bg-emerald-50">○ 正解</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {view.phase === 'judged' && (
                <div className="flex flex-col gap-3">
                  <div className={`rounded-xl px-4 py-3 text-center text-lg font-bold ${view.result?.correct ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                    {view.result?.correct
                      ? `⭕ ${view.result.name}さん 正解！`
                      : view.result
                        ? `✗ ${view.result.name}さん 不正解…`
                        : '⏰ 時間切れ'}
                  </div>
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3">
                    <div className="flex gap-2 text-lg">
                      <span className="font-bold text-emerald-600">A.</span>
                      <span className="font-semibold">{view.answer}</span>
                    </div>
                    {view.explanation && (
                      <p className="mt-2 whitespace-pre-wrap border-t border-emerald-100 pt-2 text-sm text-gray-700">
                        <span className="mr-1 font-semibold text-amber-700">解説</span>{view.explanation}
                      </p>
                    )}
                    {view.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {view.tags.map(t => <span key={t} className="text-xs text-indigo-600">#{t}</span>)}
                      </div>
                    )}
                  </div>
                  {isHost ? (
                    <button onClick={() => engineRef.current?.next()} className={`${btn.primary} py-3`}>
                      {view.index + 1 >= view.total ? '🏆 結果発表' : '次の問題へ →'}
                    </button>
                  ) : (
                    <p className="text-center text-xs text-gray-400">ホストが次の問題に進むのを待っています…</p>
                  )}
                </div>
              )}
            </div>

            {isHost && view.phase !== 'judged' && (
              <div className="flex justify-end gap-2 border-t border-gray-100 bg-gray-50 px-4 py-2">
                <button onClick={() => engineRef.current?.skip()} className={btn.ghost}>この問題をスキップ</button>
                <button onClick={() => engineRef.current?.finish()} className={btn.ghost}>終了して結果発表</button>
              </div>
            )}
          </div>
        )}

        {/* 結果発表 */}
        {view.phase === 'finished' && (
          <div className={`${card} flex flex-col gap-4 p-6`}>
            <h2 className="text-center text-2xl font-black">🏆 結果発表</h2>
            <ol className="flex flex-col gap-2">
              {scoreboard.map(m => {
                const rank = scoreboard.filter(x => x.score > m.score).length
                return (
                <li key={m.id} className={`flex items-center gap-3 rounded-xl px-4 py-3 ${rank === 0 ? 'bg-amber-50 ring-2 ring-amber-300' : 'bg-gray-50'}`}>
                  <span className="w-8 text-center text-xl">{['🥇', '🥈', '🥉'][rank] ?? `${rank + 1}`}</span>
                  <span className="flex-1 font-semibold">{m.name}{m.id === me.id && <span className="ml-1 text-xs text-gray-400">（あなた）</span>}</span>
                  <span className="text-lg font-bold tabular-nums">{m.score}<span className="ml-0.5 text-xs font-normal text-gray-500">問</span></span>
                </li>
                )
              })}
            </ol>
            {isHost && <button onClick={() => engineRef.current?.backToLobby()} className={btn.primary}>もう一度あそぶ</button>}
          </div>
        )}
      </div>

      {/* 参加者 */}
      <aside className={`${card} h-fit p-4`}>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-bold">参加者 {members.length}人</span>
          <span className={`h-2 w-2 rounded-full ${status === 'connected' ? 'bg-emerald-500' : status === 'error' ? 'bg-red-500' : 'bg-amber-400'}`} title={status} />
        </div>
        <ul className="flex flex-col gap-1">
          {scoreboard.map(m => (
            <li key={m.id} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${view.buzzer?.id === m.id ? 'bg-rose-50' : ''}`}>
              <span className="min-w-0 flex-1 truncate">
                {m.role === 'host' && <span className="mr-1" title="ホスト">👑</span>}
                {m.name}
                {m.id === me.id && <span className="ml-1 text-xs text-gray-400">（あなた）</span>}
                {view.lockedOut.includes(m.id) && <span className="ml-1 text-xs text-rose-400">お手つき</span>}
              </span>
              <span className="font-bold tabular-nums text-indigo-700">{m.score}</span>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  )
}

function Setting({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-medium text-gray-500">{label}</div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}

function Opt({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`rounded-lg border px-2.5 py-1 text-xs transition-colors ${active ? 'border-indigo-600 bg-indigo-50 font-semibold text-indigo-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
      {children}
    </button>
  )
}

// startAt（performance.now 基準）から totalMs を数える残り時間バー。startAt 前は満タンで待機表示。
function TimeBar({
  startAt,
  totalMs,
  label,
  pendingLabel,
  urgentTone = false,
}: {
  startAt: number | null
  totalMs: number
  label: string
  pendingLabel?: string
  urgentTone?: boolean
}) {
  const [left, setLeft] = useState<number | null>(null)
  useEffect(() => {
    if (startAt === null) return
    const id = setInterval(() => {
      const now = performance.now()
      setLeft(now < startAt ? null : Math.max(0, totalMs - (now - startAt)))
    }, 100)
    return () => clearInterval(id)
  }, [startAt, totalMs])

  const waiting = left === null
  const ms = left ?? totalMs
  const sec = Math.ceil(ms / 1000)
  const urgent = !waiting && sec <= 3
  const barColor = urgent ? 'bg-rose-500' : waiting ? 'bg-gray-300' : urgentTone ? 'bg-amber-400' : 'bg-indigo-500'

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-gray-500">{waiting && pendingLabel ? pendingLabel : label}</span>
        <span className={`font-mono text-sm font-bold tabular-nums ${urgent ? 'text-rose-600' : 'text-gray-700'}`}>
          {waiting && pendingLabel ? limitLabel(totalMs) : `残り ${sec}秒`}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-gray-100">
        <div className={`h-full rounded-full transition-[width] duration-100 ease-linear ${barColor}`} style={{ width: `${(ms / totalMs) * 100}%` }} />
      </div>
    </div>
  )
}
