"use client";

import confetti from "canvas-confetti";
import { AnimatePresence, motion } from "motion/react";
import { BookOpen, Check, ChevronRight, Home, RotateCcw, Shield, Swords, Trophy, User, Volume2, VolumeX, X } from "lucide-react";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { GameGlyph } from "@/components/game/GameGlyph";
import { TeamEmblem } from "@/components/ui/TeamEmblem";
import { SUBJECTS } from "@/content";
import { buildDeckIds, deckFromIds, toPlayable, type PlayableQuestion } from "@/core/deck";
import type { Grade, Question } from "@/core/model";
import { createRng, randomSeed, shuffle } from "@/core/random";
import { findUnit, getSubject, loadPool, unitsFor, useGradePool } from "@/core/repository";
import { getGame } from "@/games/registry";
import { GAME_SCREENS } from "@/games/screens";
import type { SoloMode, SoloResult } from "@/games/shared/solo";
import type { GameConfig } from "@/games/types";
import { cssColor } from "@/lib/color";
import { getSeen, memoryScope } from "@/lib/memory";
import { spring } from "@/lib/motion";
import { newSessionId } from "@/lib/session";
import { isSoundOn, setSoundOn, sfx } from "@/lib/sound";
import { botSkill, GUARD_MATCHES, rankName, SAFE_BELOW, tierOf, TIERS, TOP_STEP, type Rank } from "./league";
import { GameButton, LeagueShield, LpBar, Panel, tap } from "./parts";
import {
  addStats,
  BOT_NAMES,
  getProfile,
  matchesToday,
  MAX_SHIELDS,
  MOBILE_GAMES,
  PLAYER_ID,
  profileStore,
  QUEST_MATCHES,
  recordMatch,
  resetProfile,
  updateProfile,
  useProfile,
  weakUnits,
  type MatchOutcome,
  type MobileGameId,
  type Profile,
} from "./profile";

/**
 * OynaBil Mobil prototipi: telefonda tek kişilik, bilgisayar rakibe karşı dereceli maçlar.
 * Lobi, eşleşme, maç, maç sonu, lig, çalışma ve profil ekranları. Sunucu yoktur; kayıt telefonda durur.
 * Yön ve sonraki aşamalar: docs/MOBIL-PLATFORM.md.
 */

/** Mobil maçlar kısadır: altı soru ya da doksan saniyelik halat. */
const MATCH_SETTINGS = { questions: 6, seconds: 20 };
const TUG_SETTINGS = { target: 4, seconds: 90 };
const settingsFor = (gameId: string) => (gameId === "halat-cekme" ? TUG_SETTINGS : MATCH_SETTINGS);
/** Mobil maçların sorulanlar hafızası tahtadakinden ayrıdır. */
const SECTION = "mobil";
const PRACTICE_SIZE = 8;
/** Çalışmanın kalkan kazandırması için gereken en az doğru. */
const PRACTICE_PASS = 5;

type Tab = "ana" | "lig" | "calis" | "profil";
type Flow =
  | { kind: "tabs" }
  | { kind: "search" }
  | { kind: "match" }
  | { kind: "result"; outcome: MatchOutcome; before: Rank; result: SoloResult; gameId: string }
  | { kind: "practice"; unit: string };

const subjectsFor = (grade: Grade) => SUBJECTS.filter((s) => s.grades.includes(grade) && unitsFor(s, grade).length > 0);
const isChoice = (q: Question) => q.type === "multiple-choice";

/** Yeni bir maç kurar: oyun, ders, deste ve rakip. Yeterli sorusu olan ilk ders seçilir. */
async function createMatch(p: Profile): Promise<Profile["active"]> {
  const seed = randomSeed();
  const rng = createRng(seed);
  const gameId: MobileGameId = p.game === "sirayla" ? MOBILE_GAMES[p.history.length % MOBILE_GAMES.length] : p.game;
  const all = subjectsFor(p.grade);
  const wanted = all.find((s) => s.id === p.subject);
  const order = wanted ? [wanted, ...shuffle(all.filter((s) => s !== wanted), rng)] : shuffle(all, rng);
  const needed = Math.max(12, getGame(gameId)!.questionsNeeded(settingsFor(gameId), 2));
  for (const subject of order) {
    const pool = (await loadPool(subject.id, p.grade)).filter(isChoice);
    if (pool.length < needed) continue;
    const unitIds = unitsFor(subject, p.grade).map((u) => u.id);
    const deckIds = buildDeckIds(pool, { unitIds, types: ["multiple-choice"], seed, seen: getSeen(memoryScope(subject.id, p.grade, SECTION)) });
    const opponent = BOT_NAMES[Math.floor(rng() * BOT_NAMES.length)];
    const config: GameConfig = {
      gameId,
      subjectId: subject.id,
      grade: p.grade,
      unitIds,
      section: SECTION,
      teams: [
        { id: PLAYER_ID, name: p.name || "Sen", color: "kobalt" },
        { id: "rakip", name: opponent, color: "mercan" },
      ],
      settings: settingsFor(gameId),
      seed,
      deckIds,
      sessionId: newSessionId(),
    };
    return { config, opponent, skill: botSkill(p.rank.mmr) };
  }
  return null;
}

export function MobileApp() {
  const p = useProfile();
  const [tab, setTab] = useState<Tab>("ana");
  const [flow, setFlow] = useState<Flow>(() => (getProfile().active ? { kind: "match" } : { kind: "tabs" }));
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const play = async () => {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    const active = await createMatch(getProfile());
    setBusy(false);
    if (!active) {
      setNotice("Bu sınıf ve ders için yeterli soru bulunamadı. Başka bir ders seç.");
      return;
    }
    updateProfile({ active });
    setFlow({ kind: "search" });
  };

  if (!p.ready) return <Welcome />;
  if (flow.kind === "search" && p.active) return <Matchmaking active={p.active} me={p} onReady={() => setFlow({ kind: "match" })} />;
  if (flow.kind === "match" && p.active)
    return (
      <Match
        active={p.active}
        onQuit={() => {
          updateProfile({ active: null });
          setFlow({ kind: "tabs" });
        }}
        onResult={(result) => {
          const before = getProfile();
          const { config, opponent } = before.active!;
          const done = recordMatch(before, { sessionId: config.sessionId, gameId: config.gameId, subjectId: config.subjectId, opponent, ...result }, Date.now());
          if (!done) return setFlow({ kind: "tabs" });
          profileStore.set(done.profile);
          setFlow({ kind: "result", outcome: done.outcome, before: before.rank, result, gameId: config.gameId });
        }}
      />
    );
  if (flow.kind === "result")
    return <MatchEnd flow={flow} me={p} busy={busy} onAgain={play} onLobby={() => setFlow({ kind: "tabs" })} onStudy={(unit) => setFlow({ kind: "practice", unit })} />;
  if (flow.kind === "practice") return <Practice unit={flow.unit} grade={p.grade} onClose={() => setFlow({ kind: "tabs" })} />;

  return (
    <Frame>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-4">
        {tab === "ana" && <Lobby p={p} busy={busy} notice={notice} onPlay={play} />}
        {tab === "lig" && <LeagueTab p={p} />}
        {tab === "calis" && <StudyTab p={p} onStudy={(unit) => setFlow({ kind: "practice", unit })} />}
        {tab === "profil" && <ProfileTab p={p} />}
      </div>
      <nav className="grid shrink-0 grid-cols-4 bg-ink-950 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]" aria-label="Bölümler">
        {(
          [
            ["ana", "Ana", Home],
            ["lig", "Lig", Trophy],
            ["calis", "Çalış", BookOpen],
            ["profil", "Profil", User],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            aria-current={tab === id}
            onClick={() => {
              tap();
              setTab(id);
            }}
            className={`flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-sm font-bold ${tab === id ? "text-kehribar" : "text-ink-400"}`}
          >
            <Icon className="size-6" strokeWidth={tab === id ? 2.8 : 2} />
            {label}
          </button>
        ))}
      </nav>
    </Frame>
  );
}

/** Telefon çerçevesi: geniş ekranda ortalanmış dar bir sütun. */
function Frame({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className="board h-dvh bg-ink-950">
      <div className={`mx-auto flex h-full max-w-md flex-col bg-[radial-gradient(120%_70%_at_50%_0%,var(--color-ink-700),var(--color-ink-900)_70%)] ${className}`}>{children}</div>
    </div>
  );
}

function Welcome() {
  const [name, setName] = useState("");
  const [grade, setGrade] = useState<Grade>(7);
  return (
    <Frame className="justify-center gap-5 px-6">
      <LeagueShield step={0} className="mx-auto size-28" />
      <h1 className="text-center text-4xl font-bold">
        OynaBil <span className="text-kehribar">Mobil</span>
      </h1>
      <p className="text-center text-lg text-ink-300">Soruyu bil, atışı yap, ligde yüksel.</p>
      <label className="text-base font-bold text-ink-300" htmlFor="mobil-ad">
        Takma adın
      </label>
      <input
        id="mobil-ad"
        value={name}
        maxLength={14}
        onChange={(e) => setName(e.target.value)}
        placeholder="Örn. Kartal07"
        className="-mt-3 rounded-2xl bg-ink-950 px-4 py-3 text-xl font-bold text-cream placeholder:text-ink-600"
      />
      <p className="text-base font-bold text-ink-300">Sınıfın</p>
      <GradePicker grade={grade} onPick={setGrade} />
      <GameButton onPress={() => updateProfile({ ready: true, name: name.trim() || "Oyuncu", grade })} className="mt-2 !text-2xl">
        Başla
      </GameButton>
    </Frame>
  );
}

function GradePicker({ grade, onPick }: { grade: Grade; onPick: (g: Grade) => void }) {
  return (
    <div className="-mt-3 grid grid-cols-8 gap-1.5" role="radiogroup" aria-label="Sınıf">
      {([1, 2, 3, 4, 5, 6, 7, 8] as Grade[]).map((g) => (
        <button
          key={g}
          type="button"
          role="radio"
          aria-checked={grade === g}
          onClick={() => {
            tap();
            onPick(g);
          }}
          className={`rounded-xl py-2.5 text-xl font-bold ${grade === g ? "bg-kehribar text-ink-950" : "bg-ink-950 text-ink-300"}`}
        >
          {g}
        </button>
      ))}
    </div>
  );
}

function Chip({ on, onPick, children }: { on: boolean; onPick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => {
        tap();
        onPick();
      }}
      className={`flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-base font-bold ${on ? "bg-cream text-ink-950" : "bg-ink-950/70 text-ink-300"}`}
    >
      {children}
    </button>
  );
}

function Lobby({ p, busy, notice, onPlay }: { p: Profile; busy: boolean; notice: string | null; onPlay: () => void }) {
  const tier = tierOf(p.rank.step);
  const [openedAt] = useState(() => Date.now());
  const today = matchesToday(p, openedAt);
  const nextGame = p.game === "sirayla" ? MOBILE_GAMES[p.history.length % MOBILE_GAMES.length] : p.game;
  return (
    <div className="flex min-h-full flex-col gap-4">
      <header className="flex items-center gap-3">
        <TeamEmblem color="kobalt" className="size-10" />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-xl font-bold">{p.name}</p>
          <p className="text-sm font-semibold text-ink-300">{p.grade}. sınıf</p>
        </div>
        <p className="flex items-center gap-1.5 rounded-full bg-ink-950/70 px-3 py-1.5 text-base font-bold" aria-label={`${p.shields} kalkan`}>
          <Shield className="size-5 fill-firuze text-firuze" /> {p.shields}
        </p>
      </header>

      <motion.div className="flex flex-col items-center gap-1 py-1" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={spring.enter}>
        <LeagueShield step={p.rank.step} className="size-32 drop-shadow-[0_0.5rem_0_rgb(0_0_0/0.35)]" />
        <p className="text-3xl font-bold" style={{ color: tier.color }}>
          {rankName(p.rank.step)}
        </p>
        <LpBar lp={p.rank.step >= TOP_STEP ? 100 : p.rank.lp} color={tier.color} className="w-56" />
        <p className="tabular text-sm font-semibold text-ink-300">{p.rank.step >= TOP_STEP ? `${p.rank.lp} lig puanı` : `${p.rank.lp} / 100 lig puanı`}</p>
        {p.rank.guard > 0 && <p className="text-sm font-semibold text-firuze">Yeni basamak koruması: {p.rank.guard} maç puan kaybetmezsin</p>}
      </motion.div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" aria-label="Oyun">
        <Chip on={p.game === "sirayla"} onPick={() => updateProfile({ game: "sirayla" })}>
          Sırayla
        </Chip>
        {MOBILE_GAMES.map((g) => (
          <Chip key={g} on={p.game === g} onPick={() => updateProfile({ game: g })}>
            {getGame(g)!.name}
          </Chip>
        ))}
      </div>
      <div className="-mx-4 -mt-2 flex gap-2 overflow-x-auto px-4 pb-1" aria-label="Ders">
        <Chip on={p.subject === "karisik"} onPick={() => updateProfile({ subject: "karisik" })}>
          Karışık
        </Chip>
        {subjectsFor(p.grade).map((s) => (
          <Chip key={s.id} on={p.subject === s.id} onPick={() => updateProfile({ subject: s.id })}>
            {s.shortName}
          </Chip>
        ))}
      </div>

      <motion.div animate={busy ? {} : { scale: [1, 1.03, 1] }} transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}>
        <GameButton onPress={onPlay} disabled={busy} className="w-full flex-col !gap-0 !rounded-3xl !py-4">
          <span className="flex items-center gap-3 text-4xl leading-none">
            <Swords className="size-9" strokeWidth={2.5} /> OYNA
          </span>
          <span className="mt-1 text-sm font-bold opacity-75">Dereceli · {getGame(nextGame)!.name}</span>
        </GameButton>
      </motion.div>
      {notice && <p className="text-center text-base font-semibold text-mercan">{notice}</p>}

      <Panel>
        <div className="flex items-center gap-3">
          <p className="flex-1 text-lg font-bold">Günlük görev</p>
          <p className="tabular text-base font-bold text-ink-300">
            {Math.min(today, QUEST_MATCHES)} / {QUEST_MATCHES} maç
          </p>
        </div>
        <LpBar lp={(Math.min(today, QUEST_MATCHES) / QUEST_MATCHES) * 100} color="var(--color-zumrut)" className="mt-2" />
        <p className="mt-2 text-sm text-ink-300">{today >= QUEST_MATCHES ? "Bugünkü görev tamam: kalkanını aldın." : "Bugün üç maç oyna, bir kalkan kazan. Kalkan, yenilgide puan kaybını yarıya indirir."}</p>
      </Panel>
      <p className="mt-auto text-center text-sm text-ink-400">Prototip: rakipler şimdilik bilgisayardır.</p>
    </div>
  );
}

function Matchmaking({ active, me, onReady }: { active: NonNullable<Profile["active"]>; me: Profile; onReady: () => void }) {
  const [found, setFound] = useState(false);
  useEffect(() => {
    const a = window.setTimeout(() => {
      setFound(true);
      sfx.go();
    }, 1500);
    const b = window.setTimeout(onReady, 3600);
    return () => {
      window.clearTimeout(a);
      window.clearTimeout(b);
    };
    // Yalnızca ekran açılırken kurulur.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const game = getGame(active.config.gameId)!;
  const subject = getSubject(active.config.subjectId);
  return (
    <Frame className="items-center justify-center gap-6 px-6">
      <GameGlyph id={game.id} selected />
      <p className="text-center text-2xl font-bold">
        {game.name} · {subject?.shortName}
      </p>
      <div className="flex w-full items-center justify-between gap-3">
        <motion.div className="flex flex-1 flex-col items-center gap-2" initial={{ x: -80, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={spring.enter}>
          <TeamEmblem color="kobalt" className="size-20" />
          <p className="max-w-full truncate text-xl font-bold text-kobalt">{me.name}</p>
          <p className="text-sm font-semibold text-ink-300">{rankName(me.rank.step)}</p>
        </motion.div>
        <p className="text-4xl font-bold text-kehribar">VS</p>
        <div className="flex flex-1 flex-col items-center gap-2">
          {found ? (
            <motion.div className="flex flex-col items-center gap-2" initial={{ x: 80, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={spring.celebrate}>
              <TeamEmblem color="mercan" className="size-20" />
              <p className="max-w-full truncate text-xl font-bold text-mercan">{active.opponent}</p>
              <p className="text-sm font-semibold text-ink-300">Bilgisayar rakip</p>
            </motion.div>
          ) : (
            <>
              <motion.div className="size-20 rounded-full border-8 border-ink-700 border-t-mercan" animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }} />
              <p className="text-xl font-bold text-ink-300">Aranıyor…</p>
              <p className="text-sm text-transparent">.</p>
            </>
          )}
        </div>
      </div>
      <p className="text-center text-lg text-ink-300">{found ? "Hazır ol!" : "Rakip aranıyor"}</p>
    </Frame>
  );
}

function Match({ active, onResult, onQuit }: { active: NonNullable<Profile["active"]>; onResult: (r: SoloResult) => void; onQuit: () => void }) {
  const { config } = active;
  const pool = useGradePool(config.subjectId, config.grade, { includeHidden: true });
  const deck = useMemo(() => (pool ? deckFromIds(pool, config.deckIds, config.seed) : null), [pool, config]);
  const [sound, setSound] = useState(isSoundOn);
  const [confirming, setConfirming] = useState(false);
  // Maç boyunca aynı nesne kalmalı: oyun ekranı sonucu bir kez bildirir.
  const [handlers] = useState(() => ({ onResult }));
  const solo = useMemo<SoloMode>(() => ({ bot: { skill: active.skill }, onResult: (r) => handlers.onResult(r) }), [active.skill, handlers]);
  const Screen = GAME_SCREENS[config.gameId];
  return (
    <div className="board relative flex h-dvh flex-col overflow-hidden bg-ink-900">
      <header className="relative z-20 flex h-12 shrink-0 items-center gap-2 px-3 pt-[env(safe-area-inset-top)]">
        <button type="button" aria-label="Maçtan çık" onClick={() => setConfirming(true)} className="grid size-10 place-items-center rounded-xl text-ink-300">
          <X className="size-6" />
        </button>
        <p className="flex-1 truncate text-center text-base font-bold text-ink-300">
          {getGame(config.gameId)!.name} · {getSubject(config.subjectId)?.shortName}
        </p>
        <button
          type="button"
          aria-label={sound ? "Sesi kapat" : "Sesi aç"}
          onClick={() => {
            setSoundOn(!sound);
            setSound(!sound);
          }}
          className="grid size-10 place-items-center rounded-xl text-ink-300"
        >
          {sound ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
        </button>
      </header>
      <main className="relative z-10 flex min-h-0 flex-1 flex-col">
        {deck && Screen && (
          <Suspense fallback={null}>
            <Screen key={config.sessionId} config={config} deck={deck} onExit={onQuit} onRestart={onQuit} solo={solo} />
          </Suspense>
        )}
      </main>
      {confirming && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-ink-950/80 px-6" role="dialog" aria-modal aria-label="Maçtan çık">
          <Panel className="flex w-full max-w-sm flex-col gap-3">
            <p className="text-2xl font-bold">Maçtan çıkılsın mı?</p>
            <p className="text-base text-ink-300">Maç iptal olur; lig puanın değişmez.</p>
            <div className="mt-1 grid grid-cols-2 gap-3">
              <GameButton tone="ghost" onPress={() => setConfirming(false)}>
                Devam et
              </GameButton>
              <GameButton tone="red" onPress={onQuit}>
                Çık
              </GameButton>
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}

function MatchEnd({
  flow,
  me,
  busy,
  onAgain,
  onLobby,
  onStudy,
}: {
  flow: Extract<Flow, { kind: "result" }>;
  me: Profile;
  busy: boolean;
  onAgain: () => void;
  onLobby: () => void;
  onStudy: (unit: string) => void;
}) {
  const { outcome, before, result } = flow;
  const kind = outcome.record.outcome;
  const after = me.rank;
  const tier = tierOf(after.step);
  // Çubuk önce eski puanda görünür, sonra yenisine dolar.
  const [shown, setShown] = useState(outcome.promoted || outcome.demoted ? 0 : before.lp);
  useEffect(() => {
    const id = window.setTimeout(() => setShown(after.lp), 500);
    if (kind === "win") {
      sfx.win();
      confetti({ particleCount: outcome.promoted ? 160 : 80, spread: 90, startVelocity: 42, origin: { x: 0.5, y: 0.3 }, colors: [tier.color, "var(--color-cream)", "var(--color-kobalt)"].map(cssColor), disableForReducedMotion: true });
    }
    return () => window.clearTimeout(id);
    // Yalnızca ekran açılırken çalışır.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mine = result.log.filter((l) => l.teamId === PLAYER_ID);
  const missed = [...new Set(mine.filter((l) => !l.correct).map((l) => l.questionId))].flatMap((id) => result.deck.find((q) => q.id === id) ?? []);
  const weak = weakUnits(addStats({}, mine), 1)[0] ?? (missed[0] ? { unit: missed[0].unit, right: 0, total: 1 } : null);
  const title = kind === "win" ? "GALİBİYET!" : kind === "loss" ? "YENİLGİ" : "BERABERE";

  return (
    <Frame>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-4">
        <motion.h1
          className={`text-center text-5xl font-bold ${kind === "win" ? "text-kehribar" : kind === "loss" ? "text-ink-300" : "text-cream"}`}
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={spring.celebrate}
        >
          {title}
        </motion.h1>
        <div className="flex items-center justify-center gap-4">
          <TeamEmblem color="kobalt" className="size-10" />
          <p className="tabular text-5xl font-bold">
            {result.score[0]} <span className="text-ink-400">–</span> {result.score[1]}
          </p>
          <TeamEmblem color="mercan" className="size-10" />
        </div>

        <Panel className="flex items-center gap-4">
          <LeagueShield step={after.step} className="size-16 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <p className="flex-1 text-xl font-bold" style={{ color: tier.color }}>
                {rankName(after.step)}
              </p>
              <p className={`tabular text-xl font-bold ${outcome.delta > 0 ? "text-zumrut" : outcome.delta < 0 ? "text-mercan" : "text-ink-300"}`}>
                {outcome.delta > 0 ? "+" : ""}
                {outcome.delta} puan
              </p>
            </div>
            <LpBar lp={after.step >= TOP_STEP ? 100 : shown} color={tier.color} className="mt-2" />
            <p className="mt-1.5 text-sm font-semibold text-ink-300">
              {outcome.promoted
                ? `Basamak atladın! ${GUARD_MATCHES} maç boyunca puan kaybetmezsin.`
                : outcome.demoted
                  ? "Bir basamak düştün. Geri almak için bir galibiyet yeter."
                  : outcome.guarded
                    ? "Yeni basamak koruması: puan kaybetmedin."
                    : outcome.shieldUsed
                      ? "Kalkanın kaybını yarıya indirdi."
                      : kind === "loss" && after.step < SAFE_BELOW && after.lp === 0
                        ? "Bronz ve Gümüş'te lig düşmez."
                        : `${after.lp} / 100 lig puanı`}
            </p>
            {outcome.questDone && <p className="mt-1 text-sm font-bold text-firuze">Günlük görev tamam: bir kalkan kazandın!</p>}
          </div>
        </Panel>

        {weak && findUnit(weak.unit) && (
          <Panel>
            <p className="text-sm font-bold tracking-wide text-ink-300 uppercase">Zayıf konun</p>
            <p className="mt-0.5 text-xl font-bold">{findUnit(weak.unit)!.title}</p>
            <GameButton tone="green" className="mt-3 w-full" onPress={() => onStudy(weak.unit)}>
              <BookOpen className="size-5" /> 2 dakika çalış, kalkan kazan
            </GameButton>
          </Panel>
        )}

        {missed.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-lg font-bold">Yanlışların ({missed.length})</p>
            {missed.map((q) => (
              <div key={q.id} className="rounded-2xl bg-ink-850 p-3.5">
                <p className="text-base font-semibold">{q.prompt}</p>
                <p className="mt-1.5 flex items-start gap-1.5 text-base font-bold text-zumrut">
                  <Check className="mt-0.5 size-5 shrink-0" strokeWidth={3} />
                  {q.options[q.correctIndex]}
                </p>
                <p className="mt-1 text-sm text-ink-300">{q.explanation}</p>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="grid shrink-0 grid-cols-[1fr_1.4fr] gap-3 bg-ink-950 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <GameButton tone="ghost" onPress={onLobby}>
          Lobi
        </GameButton>
        <GameButton onPress={onAgain} disabled={busy}>
          <RotateCcw className="size-5" strokeWidth={3} /> Tekrar oyna
        </GameButton>
      </div>
    </Frame>
  );
}

function LeagueTab({ p }: { p: Profile }) {
  const current = Math.min(TIERS.length - 1, Math.floor(p.rank.step / 3));
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-bold">Lig</h1>
      <div className="flex flex-col gap-2">
        {[...TIERS.keys()].reverse().map((i) => {
          const t = TIERS[i];
          const here = i === current;
          return (
            <div key={t.id} className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 ${here ? "bg-ink-700 outline-2 outline-kehribar" : "bg-ink-850"} ${i > current ? "opacity-60" : ""}`}>
              <LeagueShield step={Math.min(TOP_STEP, i * 3 + (here ? p.rank.step % 3 : 2))} className="size-11 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xl font-bold" style={{ color: t.color }}>
                  {here ? rankName(p.rank.step) : t.name}
                </p>
                {here && (
                  <>
                    <LpBar lp={p.rank.step >= TOP_STEP ? 100 : p.rank.lp} color={t.color} className="mt-1" />
                    <p className="mt-1 text-sm font-semibold text-ink-300">{p.rank.step >= TOP_STEP ? `${p.rank.lp} puan` : `Sıradaki basamağa ${100 - p.rank.lp} puan`}</p>
                  </>
                )}
              </div>
              {here && <span className="rounded-lg bg-kehribar px-2 py-0.5 text-sm font-bold text-ink-950">Sen</span>}
            </div>
          );
        })}
      </div>
      <Panel className="text-base text-ink-300">
        <p>Galibiyet lig puanı kazandırır, 100 puanda basamak atlarsın.</p>
        <p className="mt-1.5">{"Bronz ve Gümüş'te lig düşmez. Kalkan, yenilgide kaybı yarıya indirir."}</p>
      </Panel>
      <h2 className="text-xl font-bold">Son maçlar</h2>
      {p.history.length === 0 ? (
        <p className="text-base text-ink-300">Henüz maç yok. Ana ekrandan ilk maçına başla.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {[...p.history]
            .reverse()
            .slice(0, 12)
            .map((m) => (
              <li key={m.sessionId} className="flex items-center gap-3 rounded-2xl bg-ink-850 px-3 py-2.5">
                <span className={`grid size-9 shrink-0 place-items-center rounded-xl text-lg font-bold text-ink-950 ${m.outcome === "win" ? "bg-zumrut" : m.outcome === "loss" ? "bg-mercan" : "bg-ink-400"}`}>
                  {m.outcome === "win" ? "G" : m.outcome === "loss" ? "M" : "B"}
                </span>
                <div className="min-w-0 flex-1 leading-tight">
                  <p className="truncate text-base font-bold">
                    {getGame(m.gameId)?.name} · {m.opponent}
                  </p>
                  <p className="tabular text-sm text-ink-300">
                    {m.score[0]} – {m.score[1]} · {getSubject(m.subjectId)?.shortName}
                  </p>
                </div>
                <p className={`tabular text-lg font-bold ${m.delta > 0 ? "text-zumrut" : m.delta < 0 ? "text-mercan" : "text-ink-300"}`}>
                  {m.delta > 0 ? "+" : ""}
                  {m.delta}
                </p>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}

function StudyTab({ p, onStudy }: { p: Profile; onStudy: (unit: string) => void }) {
  const weak = weakUnits(p.stats, 5).filter((w) => findUnit(w.unit));
  const subject = getSubject(p.subject) ?? subjectsFor(p.grade)[0];
  const units = subject ? unitsFor(subject, p.grade) : [];
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-bold">Çalış</h1>
      <Panel className="flex items-center gap-3">
        <Shield className="size-9 shrink-0 fill-firuze text-firuze" />
        <p className="text-base text-ink-300">
          {PRACTICE_SIZE} soruluk bir çalışmada en az {PRACTICE_PASS} doğru yap, bir kalkan kazan. En fazla {MAX_SHIELDS} kalkan taşıyabilirsin.
        </p>
      </Panel>
      <h2 className="text-xl font-bold">Zayıf konuların</h2>
      {weak.length === 0 ? (
        <p className="text-base text-ink-300">Henüz zayıf konu görünmüyor. Birkaç maç oynayınca burada çıkar.</p>
      ) : (
        weak.map((w) => <UnitRow key={w.unit} unit={w.unit} note={`${w.total} sorudan ${w.right} doğru`} ratio={w.right / w.total} onStudy={onStudy} />)
      )}
      {units.length > 0 && (
        <>
          <h2 className="text-xl font-bold">{subject!.name}: bütün üniteler</h2>
          {units.map((u) => {
            const s = p.stats[u.id];
            return <UnitRow key={u.id} unit={u.id} note={s ? `${s.total} sorudan ${s.right} doğru` : "Henüz çalışılmadı"} ratio={s ? s.right / s.total : null} onStudy={onStudy} />;
          })}
        </>
      )}
    </div>
  );
}

function UnitRow({ unit, note, ratio, onStudy }: { unit: string; note: string; ratio: number | null; onStudy: (unit: string) => void }) {
  const u = findUnit(unit)!;
  return (
    <button
      type="button"
      onClick={() => {
        tap();
        onStudy(unit);
      }}
      className="flex items-center gap-3 rounded-2xl bg-ink-850 px-3.5 py-3 text-left"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink-400">{u.subject.shortName}</p>
        <p className="text-lg leading-tight font-bold">{u.title}</p>
        <p className={`mt-0.5 text-sm font-semibold ${ratio === null ? "text-ink-400" : ratio < 0.5 ? "text-mercan" : ratio < 0.75 ? "text-kehribar" : "text-zumrut"}`}>{note}</p>
      </div>
      <ChevronRight className="size-6 shrink-0 text-ink-400" />
    </button>
  );
}

function Practice({ unit, grade, onClose }: { unit: string; grade: Grade; onClose: () => void }) {
  const info = findUnit(unit);
  const pool = useGradePool(info?.subject.id ?? "", info?.grade ?? grade);
  const [seed] = useState(randomSeed);
  const questions = useMemo<PlayableQuestion[] | null>(() => {
    if (!pool) return null;
    const own = pool.filter((q) => q.unit === unit && isChoice(q));
    return shuffle(own, createRng(seed))
      .slice(0, PRACTICE_SIZE)
      .map((q) => toPlayable(q, seed));
  }, [pool, unit, seed]);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [answers, setAnswers] = useState<boolean[]>([]);
  const [reward, setReward] = useState<boolean | null>(null);

  if (!info || !questions) return <Frame className="items-center justify-center text-xl text-ink-300">Yükleniyor…</Frame>;
  const q = questions[index];
  const right = answers.filter(Boolean).length;

  if (!q) {
    return (
      <Frame className="justify-center gap-5 px-6 text-center">
        <p className="text-4xl font-bold">{questions.length === 0 ? "Bu ünitede soru yok" : `${right} / ${questions.length} doğru`}</p>
        {reward !== null && (
          <motion.div className="flex flex-col items-center gap-2" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={spring.celebrate}>
            <Shield className={`size-20 ${reward ? "fill-firuze text-firuze" : "text-ink-600"}`} />
            <p className="text-xl font-bold">{reward ? "Kalkan kazandın!" : right >= PRACTICE_PASS ? "Kalkan çantan dolu." : `Kalkan için ${PRACTICE_PASS} doğru gerek. Tekrar dene!`}</p>
          </motion.div>
        )}
        <GameButton onPress={onClose}>Tamam</GameButton>
      </Frame>
    );
  }

  const answer = (option: number) => {
    if (picked !== null) return;
    const ok = option === q.correctIndex;
    if (ok) sfx.correct();
    else sfx.wrong();
    setPicked(option);
    setAnswers((a) => [...a, ok]);
  };
  const next = () => {
    const last = index + 1 >= questions.length;
    if (last) {
      const me = getProfile();
      const earned = right >= PRACTICE_PASS && me.shields < MAX_SHIELDS;
      updateProfile({
        stats: addStats(
          me.stats,
          answers.map((correct) => ({ unit, correct })),
        ),
        shields: me.shields + (earned ? 1 : 0),
      });
      setReward(earned);
      if (earned) sfx.win();
    }
    setPicked(null);
    setIndex(index + 1);
  };

  return (
    <Frame>
      <header className="flex shrink-0 items-center gap-3 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button type="button" aria-label="Çalışmayı kapat" onClick={onClose} className="grid size-10 place-items-center rounded-xl text-ink-300">
          <X className="size-6" />
        </button>
        <LpBar lp={(index / questions.length) * 100} color="var(--color-zumrut)" className="flex-1" />
        <p className="tabular w-12 text-right text-base font-bold text-ink-300">
          {index + 1}/{questions.length}
        </p>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
        <p className="text-sm font-bold text-ink-400">{info.title}</p>
        <h1 className={`leading-tight font-bold text-balance ${q.prompt.length > 90 ? "text-xl" : "text-2xl"}`}>{q.prompt}</h1>
        <div className="mt-1 flex flex-col gap-2.5">
          {q.options.map((text, i) => {
            const tone = picked === null ? "idle" : i === q.correctIndex ? "ok" : i === picked ? "bad" : "dim";
            return (
              <button
                key={i}
                type="button"
                disabled={picked !== null}
                onClick={() => answer(i)}
                className={`pressable rounded-2xl px-4 py-3.5 text-left text-lg leading-tight font-semibold ${
                  tone === "ok" ? "bg-zumrut text-ink-950" : tone === "bad" ? "bg-mercan text-ink-950" : tone === "dim" ? "bg-ink-850 text-ink-400" : "bg-ink-800 text-cream"
                }`}
              >
                {text}
              </button>
            );
          })}
        </div>
        <AnimatePresence>
          {picked !== null && (
            <motion.p className="rounded-2xl bg-ink-950/70 p-3.5 text-base text-ink-300" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              {q.explanation}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
      <div className="shrink-0 bg-ink-950 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <GameButton onPress={next} disabled={picked === null} className="w-full">
          {index + 1 >= questions.length ? "Bitir" : "Sonraki"}
        </GameButton>
      </div>
    </Frame>
  );
}

function ProfileTab({ p }: { p: Profile }) {
  const [confirming, setConfirming] = useState(false);
  const wins = p.history.filter((m) => m.outcome === "win").length;
  const totals = Object.values(p.stats).reduce((a, s) => ({ right: a.right + s.right, total: a.total + s.total }), { right: 0, total: 0 });
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-bold">Profil</h1>
      <label className="text-base font-bold text-ink-300" htmlFor="profil-ad">
        Takma ad
      </label>
      <input id="profil-ad" value={p.name} maxLength={14} onChange={(e) => updateProfile({ name: e.target.value })} className="-mt-3 rounded-2xl bg-ink-950 px-4 py-3 text-xl font-bold text-cream" />
      <p className="text-base font-bold text-ink-300">Sınıf</p>
      <GradePicker grade={p.grade} onPick={(grade) => updateProfile({ grade, subject: "karisik" })} />
      <div className="grid grid-cols-3 gap-2">
        {[
          [p.history.length, "maç"],
          [wins, "galibiyet"],
          [totals.total ? `%${Math.round((totals.right / totals.total) * 100)}` : "–", "doğru"],
        ].map(([value, label]) => (
          <Panel key={label} className="!p-3 text-center">
            <p className="tabular text-3xl font-bold">{value}</p>
            <p className="text-sm font-semibold text-ink-300">{label}</p>
          </Panel>
        ))}
      </div>
      <Link href="/" className="rounded-2xl bg-ink-850 px-4 py-3 text-lg font-bold">
        Tahta sürümüne git
      </Link>
      {confirming ? (
        <Panel className="flex flex-col gap-3">
          <p className="text-lg font-bold">Lig, kalkanlar ve geçmiş silinsin mi?</p>
          <div className="grid grid-cols-2 gap-3">
            <GameButton tone="ghost" onPress={() => setConfirming(false)}>
              Vazgeç
            </GameButton>
            <GameButton tone="red" onPress={resetProfile}>
              Sil
            </GameButton>
          </div>
        </Panel>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} className="self-start rounded-xl px-2 py-1 text-base font-semibold text-ink-400 underline">
          Kaydı sıfırla
        </button>
      )}
    </div>
  );
}
