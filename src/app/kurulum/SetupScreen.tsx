"use client";

import { motion } from "motion/react";
import { ArrowLeft, Check, Library, Play, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Girih } from "@/components/ui/Girih";
import { Logo } from "@/components/ui/Logo";
import { Segmented, Toggle } from "@/components/ui/Segmented";
import { TeamEmblem } from "@/components/ui/TeamEmblem";
import { GameGlyph } from "@/components/game/GameGlyph";
import { SUBJECTS } from "@/content";
import { countEligible } from "@/core/deck";
import type { Grade } from "@/core/model";
import { unitsFor, useQuestionPool } from "@/core/repository";
import { randomSeed } from "@/core/random";
import { GAMES, getGame } from "@/games/registry";
import { defaultTeams, TEAM_STYLES } from "@/games/teams";
import type { GameSettings, Team } from "@/games/types";
import { loadSetup, newSessionId, saveSetup, startGame } from "@/lib/session";
import { dur, ease } from "@/lib/motion";


export function SetupScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const pool = useQuestionPool();

  const [initial] = useState(() => {
    const saved = loadSetup();
    const requested = params.get("oyun");
    const gameId = (requested && getGame(requested) ? requested : saved?.gameId) ?? GAMES[0].id;
    const subject = SUBJECTS.find((s) => s.id === saved?.subjectId) ?? SUBJECTS[0];
    const grade = saved?.grade ?? subject.grades[subject.grades.length - 1];
    return {
      gameId,
      subjectId: subject.id,
      grade,
      unitIds: saved?.unitIds?.length ? saved.unitIds : unitsFor(subject, grade).slice(0, 1).map((u) => u.id),
      teams: saved?.teams?.length === 4 ? saved.teams : defaultTeams(4),
      teamCountByGame: saved?.teamCountByGame ?? {},
      settingsByGame: saved?.settingsByGame ?? {},
    };
  });

  const [gameId, setGameId] = useState(initial.gameId);
  const [subjectId] = useState(initial.subjectId);
  const [grade, setGrade] = useState<Grade>(initial.grade);
  const [unitIds, setUnitIds] = useState<string[]>(initial.unitIds);
  const [teams, setTeams] = useState<Team[]>(initial.teams);
  const [teamCountByGame, setTeamCountByGame] = useState<Record<string, number>>(initial.teamCountByGame);
  const [settingsByGame, setSettingsByGame] = useState<Record<string, GameSettings>>(initial.settingsByGame);

  const game = getGame(gameId)!;
  const subject = SUBJECTS.find((s) => s.id === subjectId)!;
  const units = unitsFor(subject, grade);
  const settings: GameSettings = { ...game.defaultSettings, ...settingsByGame[gameId] };
  const teamCount = Math.max(game.teamCount.min, Math.min(game.teamCount.max, teamCountByGame[gameId] ?? game.teamCount.default));
  const activeTeams = teams.slice(0, teamCount);

  const selectedUnits = unitIds.filter((id) => units.some((u) => u.id === id));
  const available = countEligible(pool, selectedUnits, game.questionTypes);
  const needed = game.questionsNeeded(settings, teamCount);
  const problem =
    selectedUnits.length === 0
      ? "En az bir ünite seçin."
      : available < needed
        ? `Seçili ünitelerde ${available} soru var, bu ayarlarla ${needed} soru gerekiyor. Ünite ekleyin${game.id === "bilgi-yarismasi" ? " ya da tur sayısını azaltın" : ""}.`
        : null;

  const changeGrade = (g: Grade) => {
    setGrade(g);
    setUnitIds(unitsFor(subject, g).slice(0, 1).map((u) => u.id));
  };

  const toggleUnit = (id: string) => setUnitIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  const allSelected = units.every((u) => selectedUnits.includes(u.id));

  const start = () => {
    if (problem) return;
    const finalTeams = activeTeams.map((t, i) => ({ ...t, name: t.name.trim() || defaultTeams(4)[i].name }));
    saveSetup({ gameId, subjectId, grade, unitIds: selectedUnits, teams, teamCountByGame, settingsByGame });
    startGame({
      gameId,
      subjectId,
      grade,
      unitIds: selectedUnits,
      teams: finalTeams,
      settings,
      seed: randomSeed(),
      sessionId: newSessionId(),
    });
    router.push(`/oyun/${gameId}`);
  };

  return (
    <div className="relative flex min-h-dvh flex-col bg-ink-900 lg:h-dvh">
      <Girih className="text-cream opacity-[0.045]" />

      <header className="relative flex h-16 shrink-0 items-center gap-4 px-4 sm:px-8">
        <Link href="/" aria-label="Ana sayfa" className="flex items-center gap-3 rounded-md">
          <ArrowLeft className="size-5 text-ink-400" />
          <Logo className="text-xl" />
        </Link>
        <ButtonLink href="/sorular" variant="quiet" className="ml-auto" icon={<Library className="size-5" />}>
          Soru bankası
        </ButtonLink>
      </header>

      <div className="relative grid min-h-0 flex-1 grid-cols-1 gap-5 px-4 pb-5 sm:px-8 lg:grid-cols-[0.85fr_1.2fr_1fr]">
        <Panel title="Oyun" delay={0}>
          <div className="flex flex-col gap-3">
            {GAMES.map((g) => {
              const selected = g.id === gameId;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setGameId(g.id)}
                  aria-pressed={selected}
                  className={`group relative rounded-lg p-4 text-left transition-colors duration-(--dur-base) ${
                    selected ? "bg-ink-700" : "bg-ink-800/70 hover:bg-ink-800"
                  }`}
                  style={{ boxShadow: selected ? "inset 0 0 0 2px var(--color-firuze)" : "var(--surface-light)" }}
                >
                  <div className="flex items-start gap-3">
                    <GameGlyph id={g.id} selected={selected} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xl font-bold">{g.name}</p>
                      <p className="mt-1 leading-snug text-ink-300">{g.tagline}</p>
                    </div>
                    {selected && <Check className="size-6 shrink-0 text-firuze" strokeWidth={3} />}
                  </div>
                </button>
              );
            })}
          </div>
          {game.settings.some((f) => f.kind === "toggle") && (
            <>
              <p className="mt-6 text-sm font-semibold tracking-wide text-ink-400">KURALLAR</p>
              <div className="mt-2 flex flex-col gap-3">
                {game.settings.map((field) =>
                  field.kind === "toggle" ? (
                    <Toggle
                      key={field.key}
                      label={field.label}
                      hint={field.hint}
                      checked={Boolean(settings[field.key])}
                      onChange={(v) => setSettingsByGame((m) => ({ ...m, [gameId]: { ...settings, [field.key]: v } }))}
                    />
                  ) : null,
                )}
              </div>
            </>
          )}
        </Panel>

        <Panel title={subject.name} delay={0.05}>
          <Segmented
            label="Sınıf"
            size="lg"
            value={grade}
            options={subject.grades.map((g) => ({ value: g, label: `${g}. sınıf` }))}
            onChange={changeGrade}
          />
          <div className="mt-5 flex items-center justify-between">
            <p className="text-sm font-semibold tracking-wide text-ink-400">ÜNİTELER</p>
            <button
              type="button"
              className="rounded-md px-2 py-1 text-sm font-semibold text-firuze hover:bg-ink-800"
              onClick={() => setUnitIds(allSelected ? [] : units.map((u) => u.id))}
            >
              {allSelected ? "Seçimi kaldır" : "Tümünü seç"}
            </button>
          </div>
          <ul className="mt-2 flex min-h-0 flex-col gap-2 overflow-y-auto">
            {units.map((u) => {
              const checked = selectedUnits.includes(u.id);
              const count = countEligible(pool, [u.id], game.questionTypes);
              return (
                <li key={u.id}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={checked}
                    onClick={() => toggleUnit(u.id)}
                    className={`flex w-full items-center gap-4 rounded-lg px-4 py-3 text-left transition-colors duration-(--dur-base) ${
                      checked ? "bg-ink-700" : "bg-ink-800/60 hover:bg-ink-800"
                    }`}
                  >
                    <span
                      className={`grid size-7 shrink-0 place-items-center rounded-md transition-colors duration-(--dur-base) ${checked ? "bg-firuze text-ink-950" : "bg-ink-950/50"}`}
                    >
                      {checked && <Check className="size-5" strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-ink-400">{u.order}. ünite</span>
                      <span className="block text-lg leading-tight font-semibold">{u.title}</span>
                    </span>
                    <span className="tabular shrink-0 text-ink-400">{count} soru</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel title="Takımlar ve ayarlar" delay={0.1}>
          {game.teamCount.min !== game.teamCount.max && (
            <Segmented
              label="Takım sayısı"
              value={teamCount}
              options={Array.from({ length: game.teamCount.max - game.teamCount.min + 1 }, (_, i) => {
                const n = game.teamCount.min + i;
                return { value: n, label: `${n} takım` };
              })}
              onChange={(n) => setTeamCountByGame((m) => ({ ...m, [gameId]: n }))}
            />
          )}
          <div className="mt-3 flex flex-col gap-2">
            {activeTeams.map((t, i) => (
              <label key={t.id} className="flex items-center gap-3 rounded-lg px-4 py-1.5" style={{ background: TEAM_STYLES[t.color].soft }}>
                <TeamEmblem color={t.color} className="size-8" />
                <input
                  value={t.name}
                  maxLength={18}
                  onChange={(e) => setTeams((list) => list.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                  className="h-11 min-w-0 flex-1 rounded-md bg-transparent px-2 text-xl font-bold outline-none placeholder:text-ink-400 focus:bg-ink-950/40"
                  style={{ color: TEAM_STYLES[t.color].base }}
                  placeholder={defaultTeams(4)[i].name}
                  aria-label={`${i + 1}. takımın adı`}
                />
              </label>
            ))}
          </div>
          <p className="mt-6 text-sm font-semibold tracking-wide text-ink-400">AYARLAR</p>
          <div className="mt-2 flex flex-col gap-4">
            {game.settings
              .filter((f) => f.kind === "choice")
              .map((field) =>
                field.kind === "choice" ? (
                  <div key={field.key}>
                    <p className="mb-1.5 font-semibold">{field.label}</p>
                    <Segmented
                      label={field.label}
                      value={Number(settings[field.key])}
                      options={field.options}
                      onChange={(v) => setSettingsByGame((m) => ({ ...m, [gameId]: { ...settings, [field.key]: v } }))}
                    />
                  </div>
                ) : null,
              )}
          </div>
        </Panel>
      </div>

      <footer className="sticky bottom-0 z-10 flex shrink-0 flex-col items-stretch gap-3 bg-ink-950/90 px-4 py-4 sm:flex-row sm:items-center sm:gap-6 sm:px-8 lg:relative">
        <div className="min-w-0 flex-1">
          {problem ? (
            <p className="flex items-center gap-2 text-base text-kehribar sm:text-lg">
              <TriangleAlert className="size-6 shrink-0" />
              {problem}
            </p>
          ) : (
            <p className="text-base text-ink-300 sm:text-lg">
              <span className="font-semibold text-cream">{game.name}</span>, {grade}. sınıf, {selectedUnits.length} ünite,{" "}
              <span className="tabular">{available}</span> soru hazır.
            </p>
          )}
        </div>
        <Button variant="primary" size="xl" disabled={Boolean(problem)} onClick={start} icon={<Play className="size-7 fill-current" />} className="w-full sm:w-auto">
          Oyunu başlat
        </Button>
      </footer>
    </div>
  );
}

function Panel({ title, delay, children }: { title: string; delay: number; children: ReactNode }) {
  return (
    <motion.section
      className="flex min-h-0 flex-col rounded-xl bg-ink-850/90 p-6 shadow-[var(--surface-light),var(--surface-drop)]"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: dur.slow, delay, ease }}
    >
      <h2 className="mb-4 text-xl font-bold">{title}</h2>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</div>
    </motion.section>
  );
}
