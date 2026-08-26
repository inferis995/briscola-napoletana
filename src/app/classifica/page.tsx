"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import styled, { createGlobalStyle } from "styled-components";
import { DayPicker } from "react-day-picker";
import { it } from "date-fns/locale";
import "react-day-picker/style.css";
import { supabase, Player, Couple, Match } from "@/lib/supabase";

// ===== DATE (ora locale) =====
const pad = (n: number) => String(n).padStart(2, "0");
const toKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromKey = (s: string) => new Date(s + "T00:00:00");
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const mondayOf = (d: Date) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); return addDays(x, -((x.getDay() + 6) % 7)); };
const MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
const COLORS = ["#d4a017", "#2196f3", "#e63946", "#35a566", "#a06cd5", "#ff8c42", "#e0b0ff", "#4dd0c1"];

export default function ClassificaDalVivo() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [couples, setCouples] = useState<Couple[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [selected, setSelected] = useState<Date>(new Date());
  const [newPlayer, setNewPlayer] = useState("");
  const [c1, setC1] = useState("");
  const [c2, setC2] = useState("");
  const [winnerId, setWinnerId] = useState("");
  const [loserId, setLoserId] = useState("");
  const [showManage, setShowManage] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setErr(null);
    const [p, c, m] = await Promise.all([
      supabase.from("players").select("*").order("created_at"),
      supabase.from("couples").select("*").order("created_at"),
      supabase.from("matches").select("*").order("created_at"),
    ]);
    if (p.error || c.error || m.error) {
      setErr("Errore di connessione al database. Riprova.");
    } else {
      setPlayers(p.data as Player[]);
      setCouples(c.data as Couple[]);
      setMatches(m.data as Match[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ===== MAPPE E DERIVATI =====
  const playerName = useCallback(
    (id: string) => players.find((p) => p.id === id)?.name || "?",
    [players]
  );
  const coupleLabel = useCallback(
    (c: Couple) => `${playerName(c.player1_id)} & ${playerName(c.player2_id)}`,
    [playerName]
  );
  const coupleById = useCallback((id: string) => couples.find((c) => c.id === id), [couples]);
  const colorOf = (id: string) => COLORS[Math.max(0, couples.findIndex((c) => c.id === id)) % COLORS.length];
  const activeCouples = couples.filter((c) => c.active);

  const selKey = toKey(selected);
  const dayMatches = matches.filter((m) => m.played_on === selKey);
  const playedDays = useMemo(() => Array.from(new Set(matches.map((m) => m.played_on))).map(fromKey), [matches]);

  const winsInRange = (coupleId: string, inRange: (day: string) => boolean) =>
    matches.filter((m) => inRange(m.played_on) && m.winner_couple_id === coupleId).length;
  const playedInRange = (coupleId: string, inRange: (day: string) => boolean) =>
    matches.filter((m) => inRange(m.played_on) && (m.winner_couple_id === coupleId || m.loser_couple_id === coupleId)).length;

  const weekStart = toKey(mondayOf(selected));
  const weekEnd = toKey(addDays(mondayOf(selected), 6));
  const inWeek = (day: string) => day >= weekStart && day <= weekEnd;
  const monthPrefix = `${selected.getFullYear()}-${pad(selected.getMonth() + 1)}`;
  const inMonth = (day: string) => day.startsWith(monthPrefix);

  const board = (inRange: (d: string) => boolean) =>
    couples
      .map((c) => ({ c, w: winsInRange(c.id, inRange), g: playedInRange(c.id, inRange) }))
      .filter((r) => r.g > 0 || c1 === "")
      .sort((a, b) => b.w - a.w || b.g - a.g);

  const weekBoard = useMemo(() => board(inWeek), [couples, matches, weekStart, weekEnd]); // eslint-disable-line
  const monthBoard = useMemo(() => board(inMonth), [couples, matches, monthPrefix]); // eslint-disable-line

  // ===== AZIONI =====
  const addPlayer = async () => {
    const name = newPlayer.trim();
    if (!name || busy) return;
    setBusy(true);
    const { error } = await supabase.from("players").insert({ name });
    setBusy(false);
    if (error) return setErr("Impossibile aggiungere il giocatore.");
    setNewPlayer("");
    load();
  };
  const removePlayer = async (id: string) => {
    if (!confirm("Rimuovere il giocatore? Spariranno anche le sue coppie e partite.")) return;
    await supabase.from("players").delete().eq("id", id);
    load();
  };
  const createCouple = async () => {
    if (!c1 || !c2 || c1 === c2 || busy) return;
    setBusy(true);
    const { error } = await supabase.from("couples").insert({ player1_id: c1, player2_id: c2 });
    setBusy(false);
    if (error) return setErr("Impossibile creare la coppia.");
    setC1(""); setC2("");
    load();
  };
  const toggleCouple = async (c: Couple) => {
    await supabase.from("couples").update({ active: !c.active }).eq("id", c.id);
    load();
  };
  const removeCouple = async (id: string) => {
    if (!confirm("Eliminare la coppia? Spariranno anche le sue partite.")) return;
    await supabase.from("couples").delete().eq("id", id);
    load();
  };
  const recordMatch = async () => {
    if (!winnerId || !loserId || winnerId === loserId || busy) return;
    setBusy(true);
    const { error } = await supabase.from("matches").insert({
      played_on: selKey, winner_couple_id: winnerId, loser_couple_id: loserId,
    });
    setBusy(false);
    if (error) return setErr("Impossibile registrare la partita.");
    load();
  };
  const deleteMatch = async (id: string) => {
    await supabase.from("matches").delete().eq("id", id);
    load();
  };

  const selLabel = `${selected.getDate()} ${MESI[selected.getMonth()]} ${selected.getFullYear()}`;
  const isToday = selKey === toKey(new Date());

  return (
    <>
      <GlobalStyle />
      <Page>
        <TopBar>
          <a href="/" style={{ textDecoration: "none" }}><BackBtn>← App</BackBtn></a>
          <Title>Classifica dal Vivo</Title>
          <span style={{ width: 58 }} />
        </TopBar>

        <Container>
          <Sub>Le partite di briscola giocate al tavolo, a coppie. Salvato online: chiunque apra la pagina vede la stessa classifica.</Sub>
          {err && <ErrorBox onClick={() => { setErr(null); load(); }}>{err} · tocca per riprovare</ErrorBox>}
          {loading ? (
            <Loading>Caricamento…</Loading>
          ) : (
            <>
              {/* ===== CALENDARIO ===== */}
              <Section>
                <SectionTitle>Calendario</SectionTitle>
                <CalWrap>
                  <DayPicker
                    mode="single"
                    required
                    selected={selected}
                    onSelect={(d) => d && setSelected(d)}
                    locale={it}
                    weekStartsOn={1}
                    modifiers={{ played: playedDays }}
                    modifiersClassNames={{ played: "rdp-played" }}
                    showOutsideDays
                  />
                </CalWrap>
              </Section>

              {/* ===== GIORNATA SELEZIONATA ===== */}
              <Section>
                <SectionTitle>
                  {selLabel}{isToday && <Oggi>OGGI</Oggi>}
                  <DayCount>{dayMatches.length} {dayMatches.length === 1 ? "partita" : "partite"}</DayCount>
                </SectionTitle>

                {activeCouples.length < 2 ? (
                  <Empty>Servono almeno <b>due coppie attive</b> per registrare una partita. Aprile in “Giocatori e coppie” qui sotto.</Empty>
                ) : (
                  <RecordBox>
                    <RecLabel>Chi ha vinto?</RecLabel>
                    <Select value={winnerId} onChange={(e) => setWinnerId(e.target.value)}>
                      <option value="">— coppia vincitrice —</option>
                      {activeCouples.map((c) => <option key={c.id} value={c.id}>{coupleLabel(c)}</option>)}
                    </Select>
                    <RecLabel>Contro chi?</RecLabel>
                    <Select value={loserId} onChange={(e) => setLoserId(e.target.value)}>
                      <option value="">— coppia perdente —</option>
                      {activeCouples.filter((c) => c.id !== winnerId).map((c) => <option key={c.id} value={c.id}>{coupleLabel(c)}</option>)}
                    </Select>
                    <RecordBtn onClick={recordMatch} disabled={!winnerId || !loserId || winnerId === loserId || busy}>
                      + Registra partita
                    </RecordBtn>
                  </RecordBox>
                )}

                {dayMatches.length > 0 && (
                  <MatchList>
                    {dayMatches.map((m) => {
                      const w = coupleById(m.winner_couple_id);
                      const l = coupleById(m.loser_couple_id);
                      return (
                        <MatchRow key={m.id}>
                          <Dot style={{ background: colorOf(m.winner_couple_id) }} />
                          <MatchText>
                            <b>{w ? coupleLabel(w) : "?"}</b> batte {l ? coupleLabel(l) : "?"}
                          </MatchText>
                          <Del onClick={() => deleteMatch(m.id)} title="Elimina">×</Del>
                        </MatchRow>
                      );
                    })}
                  </MatchList>
                )}
              </Section>

              {/* ===== CLASSIFICHE ===== */}
              {couples.length > 0 && (
                <BoardCols>
                  <Board>
                    <BoardTitle>🏆 Settimana</BoardTitle>
                    <BoardHint>{new Date(fromKey(weekStart)).getDate()}–{new Date(fromKey(weekEnd)).getDate()} {MESI[fromKey(weekEnd).getMonth()].slice(0, 3)}</BoardHint>
                    {weekBoard.map(({ c, w, g }, i) => (
                      <BoardRow key={c.id} $lead={i === 0 && w > 0}>
                        <Rank>{i + 1}</Rank><Dot style={{ background: colorOf(c.id) }} />
                        <BoardName>{coupleLabel(c)}</BoardName>
                        <BoardWins>{w}<Games>/{g}</Games></BoardWins>
                      </BoardRow>
                    ))}
                    {weekBoard.every((r) => r.g === 0) && <MiniEmpty>Nessuna partita</MiniEmpty>}
                  </Board>
                  <Board>
                    <BoardTitle>📅 Mese</BoardTitle>
                    <BoardHint>{MESI[selected.getMonth()]}</BoardHint>
                    {monthBoard.map(({ c, w, g }, i) => (
                      <BoardRow key={c.id} $lead={i === 0 && w > 0}>
                        <Rank>{i + 1}</Rank><Dot style={{ background: colorOf(c.id) }} />
                        <BoardName>{coupleLabel(c)}</BoardName>
                        <BoardWins>{w}<Games>/{g}</Games></BoardWins>
                      </BoardRow>
                    ))}
                    {monthBoard.every((r) => r.g === 0) && <MiniEmpty>Nessuna partita</MiniEmpty>}
                  </Board>
                </BoardCols>
              )}
              <Legend>Vittorie / partite giocate</Legend>

              {/* ===== GESTIONE ===== */}
              <ManageToggle onClick={() => setShowManage((s) => !s)}>
                {showManage ? "▲ Nascondi" : "▼ Giocatori e coppie"}
              </ManageToggle>
              {showManage && (
                <Section>
                  <SectionTitle style={{ fontSize: 16 }}>Giocatori</SectionTitle>
                  <ChipList>
                    {players.map((p) => (
                      <Chip key={p.id}>{p.name}<Del onClick={() => removePlayer(p.id)}>×</Del></Chip>
                    ))}
                    {players.length === 0 && <Empty>Aggiungi i giocatori uno per uno.</Empty>}
                  </ChipList>
                  <AddRow>
                    <Input placeholder="Nome giocatore" value={newPlayer} maxLength={16}
                      onChange={(e) => setNewPlayer(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addPlayer()} />
                    <AddBtn onClick={addPlayer} disabled={!newPlayer.trim() || busy}>+ Giocatore</AddBtn>
                  </AddRow>

                  <SectionTitle style={{ fontSize: 16, marginTop: 24 }}>Coppie</SectionTitle>
                  <CoupleMngList>
                    {couples.map((c) => (
                      <CoupleMngRow key={c.id} $off={!c.active}>
                        <Dot style={{ background: colorOf(c.id) }} />
                        <span style={{ flex: 1 }}>{coupleLabel(c)}</span>
                        <SmallBtn onClick={() => toggleCouple(c)}>{c.active ? "Sospendi" : "Riattiva"}</SmallBtn>
                        <Del onClick={() => removeCouple(c.id)}>×</Del>
                      </CoupleMngRow>
                    ))}
                    {couples.length === 0 && <Empty>Forma una coppia scegliendo due giocatori.</Empty>}
                  </CoupleMngList>
                  {players.length >= 2 && (
                    <AddRow>
                      <Select value={c1} onChange={(e) => setC1(e.target.value)} style={{ flex: 1 }}>
                        <option value="">Giocatore 1</option>
                        {players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </Select>
                      <Select value={c2} onChange={(e) => setC2(e.target.value)} style={{ flex: 1 }}>
                        <option value="">Giocatore 2</option>
                        {players.filter((p) => p.id !== c1).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </Select>
                      <AddBtn onClick={createCouple} disabled={!c1 || !c2 || c1 === c2 || busy}>+ Coppia</AddBtn>
                    </AddRow>
                  )}
                </Section>
              )}
            </>
          )}
        </Container>
      </Page>
    </>
  );
}

// ===== STILI =====
const GlobalStyle = createGlobalStyle`
  body { margin: 0; background: #0a120a; }
  /* Calendario react-day-picker vestito coi colori dell'app */
  .rdp-root {
    --rdp-accent-color: #d4a017;
    --rdp-accent-background-color: rgba(212,160,23,0.18);
    --rdp-today-color: #35a566;
    --rdp-day-width: 40px; --rdp-day-height: 40px;
    --rdp-day_button-width: 40px; --rdp-day_button-height: 40px;
    margin: 0 auto;
    color: #f5f0e8;
  }
  .rdp-month_caption { font-family: var(--font-display), serif; font-size: 17px; color: #f0cf7a; text-transform: capitalize; }
  .rdp-weekday { color: #77837b; font-size: 11px; text-transform: uppercase; }
  .rdp-day_button { color: #f5f0e8; font-size: 15px; border-radius: 9px; }
  .rdp-day_button:hover { background: rgba(212,160,23,0.12); }
  .rdp-outside .rdp-day_button { color: #3c463a; }
  .rdp-chevron { fill: #d4a017; }
  /* pallino oro sui giorni con partite */
  .rdp-played .rdp-day_button { position: relative; font-weight: 700; }
  .rdp-played .rdp-day_button::after {
    content: ''; position: absolute; bottom: 4px; left: 50%; transform: translateX(-50%);
    width: 5px; height: 5px; border-radius: 50%; background: #d4a017;
  }
  .rdp-selected .rdp-day_button { border: 1.5px solid #d4a017; background: rgba(212,160,23,0.18); }
`;

const Page = styled.div`
  min-height: 100dvh;
  background: radial-gradient(ellipse at 50% 0%, #12240f 0%, #0a120a 60%);
  color: #f5f0e8;
  font-family: 'Hanken Grotesk', 'Inter', -apple-system, sans-serif;
  padding-bottom: 60px;
`;
const TopBar = styled.div`
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 16px; background: rgba(6,10,6,0.85); backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(212,160,23,0.14); position: sticky; top: 0; z-index: 10;
`;
const BackBtn = styled.button`
  background: rgba(19,33,19,0.9); border: 1px solid rgba(212,160,23,0.25); color: #d4a017;
  font-size: 13px; font-weight: 700; padding: 7px 12px; border-radius: 9px; cursor: pointer;
`;
const Title = styled.h1`
  font-family: var(--font-display), 'Times New Roman', serif;
  font-size: clamp(16px, 4.5vw, 22px); letter-spacing: 1.5px; color: #f0cf7a; margin: 0; text-align: center;
`;
const Container = styled.div` max-width: 640px; margin: 0 auto; padding: 18px 16px; `;
const Sub = styled.p` color: #a09880; font-size: 14px; margin: 0 0 12px; text-align: center; `;
const ErrorBox = styled.div`
  background: rgba(230,57,70,0.15); border: 1px solid #e63946; color: #ff8b96;
  border-radius: 10px; padding: 10px 14px; font-size: 14px; margin-bottom: 12px; cursor: pointer; text-align: center;
`;
const Loading = styled.div` text-align: center; color: #a09880; padding: 40px 0; `;

const Section = styled.section`
  margin-top: 18px; background: rgba(19,33,19,0.55); border: 1px solid rgba(212,160,23,0.12);
  border-radius: 16px; padding: 18px;
`;
const SectionTitle = styled.h2`
  font-family: var(--font-display), serif; font-size: 18px; letter-spacing: 0.5px; margin: 0 0 14px;
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
`;
const Oggi = styled.span` font-size: 10px; font-weight: 800; letter-spacing: 1px; background: #d4a017; color: #0a120a; padding: 2px 8px; border-radius: 6px; `;
const DayCount = styled.span` margin-left: auto; font-size: 13px; color: #a09880; font-weight: 600; `;
const CalWrap = styled.div` display: flex; justify-content: center; `;

const Empty = styled.p` color: #77837b; font-size: 14px; margin: 4px 0 0; b { color: #d4a017; } `;
const MiniEmpty = styled.p` color: #5c6659; font-size: 13px; margin: 8px 0 0; text-align: center; `;

const RecordBox = styled.div` display: flex; flex-direction: column; gap: 8px; `;
const RecLabel = styled.label` font-size: 12px; color: #a09880; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; `;
const Select = styled.select`
  padding: 11px 12px; border-radius: 10px; border: 1.5px solid rgba(212,160,23,0.2);
  background: rgba(10,16,10,0.8); color: #f5f0e8; font-size: 15px; outline: none;
  &:focus { border-color: #d4a017; }
`;
const RecordBtn = styled.button`
  margin-top: 4px; background: #d4a017; color: #0a120a; border: none; padding: 12px;
  border-radius: 10px; font-weight: 800; font-size: 15px; cursor: pointer;
  &:disabled { opacity: 0.4; cursor: not-allowed; }
`;
const MatchList = styled.div` display: flex; flex-direction: column; gap: 7px; margin-top: 14px; `;
const MatchRow = styled.div`
  display: flex; align-items: center; gap: 10px; background: rgba(10,16,10,0.5);
  border-radius: 10px; padding: 9px 12px;
`;
const MatchText = styled.span` flex: 1; font-size: 14px; color: #d5cdb8; b { color: #f5f0e8; } `;
const Dot = styled.span` width: 11px; height: 11px; border-radius: 50%; flex-shrink: 0; `;
const Del = styled.button` background: none; border: none; color: #77837b; font-size: 18px; line-height: 1; cursor: pointer; padding: 0 2px; &:hover { color: #e63946; } `;

const BoardCols = styled.div`
  margin-top: 18px; display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
  @media (max-width: 520px) { grid-template-columns: 1fr; }
`;
const Board = styled.div` background: rgba(19,33,19,0.55); border: 1px solid rgba(212,160,23,0.12); border-radius: 16px; padding: 16px; `;
const BoardTitle = styled.h3` font-family: var(--font-display), serif; font-size: 15px; margin: 0; letter-spacing: 0.5px; `;
const BoardHint = styled.div` font-size: 11px; color: #77837b; margin: 2px 0 12px; text-transform: capitalize; `;
const BoardRow = styled.div<{ $lead?: boolean }>`
  display: flex; align-items: center; gap: 9px; padding: 8px 9px; border-radius: 9px; margin-bottom: 5px;
  background: ${(p) => (p.$lead ? "rgba(212,160,23,0.12)" : "rgba(10,16,10,0.5)")};
  border: 1px solid ${(p) => (p.$lead ? "rgba(212,160,23,0.4)" : "transparent")};
`;
const Rank = styled.span` width: 16px; font-size: 13px; font-weight: 800; color: #77837b; font-variant-numeric: tabular-nums; `;
const BoardName = styled.span` flex: 1; font-size: 13.5px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; `;
const BoardWins = styled.span` font-size: 19px; font-weight: 800; color: #f0cf7a; font-variant-numeric: tabular-nums; `;
const Games = styled.span` font-size: 12px; color: #77837b; font-weight: 600; `;
const Legend = styled.p` text-align: center; font-size: 11px; color: #5c6659; margin: 8px 0 0; `;

const ManageToggle = styled.button`
  width: 100%; margin-top: 18px; background: rgba(19,33,19,0.4); border: 1px solid rgba(212,160,23,0.12);
  color: #a09880; font-size: 14px; font-weight: 600; padding: 12px; border-radius: 12px; cursor: pointer;
  &:hover { color: #d4a017; }
`;
const ChipList = styled.div` display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; `;
const Chip = styled.div`
  display: inline-flex; align-items: center; gap: 6px; background: rgba(10,16,10,0.7);
  border: 1.5px solid rgba(212,160,23,0.25); border-radius: 20px; padding: 6px 8px 6px 12px; font-size: 14px; font-weight: 600;
`;
const AddRow = styled.div` display: flex; gap: 8px; flex-wrap: wrap; align-items: center; `;
const Input = styled.input`
  flex: 1; min-width: 120px; padding: 10px 12px; border-radius: 10px; border: 1.5px solid rgba(212,160,23,0.2);
  background: rgba(10,16,10,0.8); color: #f5f0e8; font-size: 15px; outline: none;
  &:focus { border-color: #d4a017; } &::placeholder { color: #5c6659; }
`;
const AddBtn = styled.button`
  background: #d4a017; color: #0a120a; border: none; padding: 10px 16px; border-radius: 10px;
  font-weight: 800; font-size: 14px; cursor: pointer; white-space: nowrap;
  &:disabled { opacity: 0.4; cursor: not-allowed; }
`;
const CoupleMngList = styled.div` display: flex; flex-direction: column; gap: 7px; margin-bottom: 12px; `;
const CoupleMngRow = styled.div<{ $off?: boolean }>`
  display: flex; align-items: center; gap: 10px; background: rgba(10,16,10,0.5); border-radius: 10px;
  padding: 9px 12px; font-size: 14px; font-weight: 600; opacity: ${(p) => (p.$off ? 0.5 : 1)};
`;
const SmallBtn = styled.button`
  background: rgba(212,160,23,0.12); border: 1px solid rgba(212,160,23,0.3); color: #d4a017;
  font-size: 11px; font-weight: 700; padding: 4px 9px; border-radius: 7px; cursor: pointer;
`;
