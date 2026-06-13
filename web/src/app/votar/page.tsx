"use client";

/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Category = "F1" | "F2";

interface DriverRow {
  id: string;
  alias: string;
  photo_url: string | null;
  active: boolean;
}
interface PollRow {
  id: string;
  race_id: string;
  category: Category;
  closes_at: string;
}
interface RaceRow {
  id: string;
  date: string;
  month_label: string;
}
interface CandidateRow {
  id: string;
  poll_id: string;
  driver_id: string;
  reason: string | null;
}
interface VoteRow {
  poll_id: string;
  voter_driver_id: string;
  candidate_id: string;
}

const VOTED_KEY = "gkd-dotd-votes"; // pollId -> voterDriverId

function readLocalVotes(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(VOTED_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export default function VotarPage() {
  const supabase = useMemo(() => createClient(), []);

  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [polls, setPolls] = useState<PollRow[]>([]);
  const [races, setRaces] = useState<RaceRow[]>([]);
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [votes, setVotes] = useState<VoteRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  const [voter, setVoter] = useState(""); // driver id of the person voting
  const [choice, setChoice] = useState<Record<string, string>>({}); // pollId -> candidateId
  const [localVotes, setLocalVotes] = useState<Record<string, string>>({});
  const [sending, setSending] = useState<string | null>(null);
  const [msg, setMsg] = useState<Record<string, { kind: "ok" | "err"; text: string }>>({});

  const aliasById = useMemo(
    () => new Map(drivers.map((d) => [d.id, d.alias])),
    [drivers]
  );
  const driverById = useMemo(
    () => new Map(drivers.map((d) => [d.id, d])),
    [drivers]
  );
  const raceById = useMemo(() => new Map(races.map((r) => [r.id, r])), [races]);

  const load = useCallback(async () => {
    const [d, p, r, c, v] = await Promise.all([
      supabase.from("drivers").select("id, alias, photo_url, active").eq("active", true).order("alias"),
      supabase.from("dotd_polls").select("*").order("closes_at", { ascending: false }),
      supabase.from("races").select("id, date, month_label"),
      supabase.from("dotd_candidates").select("*"),
      supabase.from("dotd_votes").select("poll_id, voter_driver_id, candidate_id"),
    ]);
    setDrivers((d.data as DriverRow[]) ?? []);
    setPolls((p.data as PollRow[]) ?? []);
    setRaces((r.data as RaceRow[]) ?? []);
    setCandidates((c.data as CandidateRow[]) ?? []);
    setVotes((v.data as VoteRow[]) ?? []);
    setLoaded(true);
  }, [supabase]);

  useEffect(() => {
    setLocalVotes(readLocalVotes());
    load();
  }, [load]);

  async function vote(poll: PollRow) {
    const candidateId = choice[poll.id];
    if (!voter || !candidateId) return;
    setSending(poll.id);
    setMsg((m) => ({ ...m, [poll.id]: undefined as never }));
    const { error } = await supabase.from("dotd_votes").insert({
      poll_id: poll.id,
      voter_driver_id: voter,
      candidate_id: candidateId,
    });
    if (error) {
      const dup = error.code === "23505";
      setMsg((m) => ({
        ...m,
        [poll.id]: {
          kind: "err",
          text: dup
            ? `${aliasById.get(voter)} ya votó en esta categoría — el voto no se puede cambiar.`
            : error.message,
        },
      }));
    } else {
      const next = { ...readLocalVotes(), [poll.id]: voter };
      localStorage.setItem(VOTED_KEY, JSON.stringify(next));
      setLocalVotes(next);
      setMsg((m) => ({
        ...m,
        [poll.id]: { kind: "ok", text: "¡Voto registrado! 🏆" },
      }));
      await load();
    }
    setSending(null);
  }

  const openPolls = polls.filter((p) => new Date(p.closes_at) > new Date());
  const closedPolls = polls.filter((p) => new Date(p.closes_at) <= new Date()).slice(0, 4);

  function pollTitle(p: PollRow) {
    const race = raceById.get(p.race_id);
    return `${race?.month_label ?? "?"} · ${p.category === "F1" ? "F1 Moderna" : "F1 Clásica"}`;
  }

  function votedInPoll(p: PollRow): boolean {
    if (localVotes[p.id]) return true;
    if (voter) return votes.some((v) => v.poll_id === p.id && v.voter_driver_id === voter);
    return false;
  }

  return (
    <main className="section" style={{ minHeight: "100vh" }}>
      <div className="container" style={{ maxWidth: 720 }}>
        <div className="section-header">
          <span className="tag">Driver of the Day</span>
          <h2 className="section-title">
            Vota el <span className="gold">DOTD</span>
          </h2>
          <p className="section-subtitle">
            Elige tu nombre, vota por el mejor piloto de la fecha y listo.
            Un voto por persona — no se puede cambiar.
          </p>
          <Link href="/" style={{ color: "var(--gray)", fontSize: "0.85rem" }}>
            ← Volver al sitio
          </Link>
        </div>

        {loaded && openPolls.length === 0 && (
          <div className="table-empty">
            No hay votaciones abiertas en este momento. Vuelve después de la
            próxima carrera. 🏁
          </div>
        )}

        {openPolls.length > 0 && (
          <div className="vote-field">
            <label className="vote-label">¿Quién eres?</label>
            <select
              className="vote-select"
              value={voter}
              onChange={(e) => setVoter(e.target.value)}
            >
              <option value="">— Elige tu nombre —</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>{d.alias}</option>
              ))}
            </select>
          </div>
        )}

        {openPolls.map((p) => {
          const cands = candidates.filter((c) => c.poll_id === p.id);
          const done = votedInPoll(p);
          const m = msg[p.id];
          return (
            <div key={p.id} className="vote-poll">
              <div className="vote-poll-head">
                <h3>{pollTitle(p)}</h3>
                <span className="vote-deadline">
                  Cierra: {new Date(p.closes_at).toLocaleString("es-CL", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              {m && <div className={`vote-msg ${m.kind}`}>{m.text}</div>}
              <div className="vote-candidates">
                {cands.map((c) => {
                  const d = driverById.get(c.driver_id);
                  const selected = choice[p.id] === c.id;
                  return (
                    <button
                      key={c.id}
                      className={`vote-candidate${selected ? " selected" : ""}`}
                      disabled={done}
                      onClick={() => setChoice((ch) => ({ ...ch, [p.id]: c.id }))}
                    >
                      {d?.photo_url ? (
                        <img src={d.photo_url} alt={d.alias} />
                      ) : (
                        <div className="vote-candidate-placeholder">
                          {(d?.alias ?? "?").slice(0, 2)}
                        </div>
                      )}
                      <div className="vote-candidate-info">
                        <strong>{d?.alias ?? "?"}</strong>
                        {c.reason && <span>{c.reason}</span>}
                      </div>
                      <div className={`vote-radio${selected ? " on" : ""}`} />
                    </button>
                  );
                })}
              </div>
              {done ? (
                <div className="vote-done">✅ Ya votaste en esta categoría. ¡Gracias!</div>
              ) : (
                <button
                  className="vote-submit"
                  disabled={!voter || !choice[p.id] || sending === p.id}
                  onClick={() => vote(p)}
                >
                  {sending === p.id
                    ? "Enviando…"
                    : !voter
                      ? "Elige tu nombre arriba"
                      : !choice[p.id]
                        ? "Elige un nominado"
                        : "🗳 Votar"}
                </button>
              )}
            </div>
          );
        })}

        {closedPolls.length > 0 && (
          <>
            <h3 className="vote-closed-title">Votaciones cerradas</h3>
            {closedPolls.map((p) => {
              const cands = candidates.filter((c) => c.poll_id === p.id);
              const counts = new Map<string, number>();
              for (const v of votes.filter((v) => v.poll_id === p.id)) {
                counts.set(v.candidate_id, (counts.get(v.candidate_id) ?? 0) + 1);
              }
              const total = [...counts.values()].reduce((a, b) => a + b, 0);
              return (
                <div key={p.id} className="vote-poll closed">
                  <div className="vote-poll-head">
                    <h3>{pollTitle(p)}</h3>
                    <span className="vote-deadline">{total} votos</span>
                  </div>
                  {cands
                    .sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0))
                    .map((c) => {
                      const n = counts.get(c.id) ?? 0;
                      const pct = total > 0 ? Math.round((n / total) * 100) : 0;
                      return (
                        <div key={c.id} className="vote-result-row">
                          <span className="vote-result-name">
                            {aliasById.get(c.driver_id) ?? "?"}
                          </span>
                          <div className="vote-result-bar">
                            <div style={{ width: `${pct}%` }} />
                          </div>
                          <span className="vote-result-pct">
                            {pct}% ({n})
                          </span>
                        </div>
                      );
                    })}
                </div>
              );
            })}
          </>
        )}
      </div>
    </main>
  );
}
