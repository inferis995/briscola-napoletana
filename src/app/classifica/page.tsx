"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import styled, { createGlobalStyle } from "styled-components";
import { DayPicker } from "react-day-picker";
import { it } from "date-fns/locale";
import "react-day-picker/style.css";
import { supabase, Player, Couple, DayWin } from "@/lib/supabase";

// ===== DATE (ora locale) =====
const pad = (n: number) => String(n).padStart(2, "0");
const toKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromKey = (s: string) => new Date(s + "T00:00:00");
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const mondayOf = (d: Date) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); return addDays(x, -((x.getDay() + 6) % 7)); };
const MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
const COLORS = ["#d4a017", "#2196f3", "#e63946", "#35a566", "#a06cd5", "#ff8c42", "#e0b0ff", "#4dd0c1"];
const LS_PIN = "briscola_live_pin";

type BoardMode = "couples" | "players";

export default function ClassificaDalVivo() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [couples, setCouples] = useState<Couple[]>([]);
  const [dayWins, setDayWins] = useState<DayWin[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [selected, setSelected] = useState<Date>(new Date());
  const [boardMode, setBoardMode] = useState<BoardMode>("couples");
  const [showManage, setShowManage] = useState(false);

  // PIN
  const [pinSet, setPinSet] = useState<boolean | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState("");
  const [pinModal, setPinModal] = useState<null | "set" | "enter">(null);
  const [pinInput, setPinInput] = useState("");
  const [pinErr, setPinErr] = useState("");

  // form
  const [newPlayer, setNewPlayer] = useState("");
  const [c1, setC1] = useState("");
  const [c2, setC2] = useState("");

  const load = useCallback(async () => {
    setErr(null);
    const [p, c, d] = await Promise.all([
      supabase.from("players").select("*").order("created_at"),
      supabase.from("couples").select("*").order("created_at"),
      supabase.from("day_wins").select("*"),
    ]);
    if (p.error || c.error || d.error) setErr("Errore di connessione. Tocca per riprovare.");
    else {
      setPlayers(p.data as Player[]);
      setCouples(c.data as Couple[]);
      setDayWins(d.data as DayWin[]);
    }
    setLoading(false);
  }, []);

  // Meta PIN + auto-unlock se già salvato
  const loadMeta = useCallback(async () => {
    const { data: isSet } = await supabase.rpc("pin_is_set");
    setPinSet(!!isSet);
    if (isSet) {
      let saved = "";
      try { saved = localStorage.getItem(LS_PIN) || ""; } catch {}
      if (saved) {
        const { data: ok } = await supabase.rpc("verify_pin", { candidate: saved });
        if (ok) { setPin(saved); setUnlocked(true); }
      }
    }
  }, []);

  useEffect(() => { load(); loadMeta(); }, [load, loadMeta]);

  // ===== DERIVATI =====
  const playerName = useCallback((id: string) => players.find((p) => p.id === id)?.name || "?", [players]);
  const coupleLabel = useCallback((c: Couple) => `${playerName(c.player1_id)} & ${playerName(c.player2_id)}`, [playerName]);
  const colorOf = (id: string) => COLORS[Math.max(0, couples.findIndex((c) => c.id === id)) % COLORS.length];
  const activeCouples = couples.filter((c) => c.active);

  const selKey = toKey(selected);
  const winsOn = (day: string, coupleId: string) => dayWins.find((d) => d.played_on === day && d.couple_id === coupleId)?.wins || 0;
  const gamesOnDay = (day: string) => dayWins.filter((d) => d.played_on === day).reduce((t, d) => t + d.wins, 0);
  const playedDays = useMemo(() => Array.from(new Set(dayWins.filter((d) => d.wins > 0).map((d) => d.played_on))).map(fromKey), [dayWins]);

  const weekStart = toKey(mondayOf(selected));
  const weekEnd = toKey(addDays(mondayOf(selected), 6));
  const inWeek = (day: string) => day >= weekStart && day <= weekEnd;
  const monthPrefix = `${selected.getFullYear()}-${pad(selected.getMonth() + 1)}`;
  const inMonth = (day: string) => day.startsWith(monthPrefix);

  const coupleBoard = (inRange: (d: string) => boolean) =>
    couples
      .map((c) => ({ id: c.id, label: coupleLabel(c), color: colorOf(c.id), w: dayWins.filter((d) => inRange(d.played_on) && d.couple_id === c.id).reduce((t, d) => t + d.wins, 0) }))
      .filter((r) => r.w > 0)
      .sort((a, b) => b.w - a.w);

  const playerBoard = (inRange: (d: string) => boolean) =>
    players
      .map((p) => {
        const ids = couples.filter((c) => c.player1_id === p.id || c.player2_id === p.id).map((c) => c.id);
        const w = dayWins.filter((d) => inRange(d.played_on) && ids.includes(d.couple_id)).reduce((t, d) => t + d.wins, 0);
        return { id: p.id, label: p.name, color: "#d4a017", w };
      })
      .filter((r) => r.w > 0)
      .sort((a, b) => b.w - a.w);

  const boardFn = boardMode === "couples" ? coupleBoard : playerBoard;
  const weekRows = useMemo(() => boardFn(inWeek), [boardMode, couples, players, dayWins, weekStart, weekEnd]); // eslint-disable-line
  const monthRows = useMemo(() => boardFn(inMonth), [boardMode, couples, players, dayWins, monthPrefix]); // eslint-disable-line

  // ===== PIN =====
  const lock = () => { setUnlocked(false); setPin(""); try { localStorage.removeItem(LS_PIN); } catch {} };
  const openUnlock = () => { setPinInput(""); setPinErr(""); setPinModal(pinSet ? "enter" : "set"); };
  const submitPin = async () => {
    const v = pinInput.trim();
    if (pinModal === "set") {
      if (v.length < 4) { setPinErr("Almeno 4 cifre."); return; }
      const { data: ok } = await supabase.rpc("set_pin", { candidate: v });
      if (!ok) { setPinErr("Impossibile impostare (forse già esistente)."); loadMeta(); return; }
      setPinSet(true);
    } else {
      const { data: ok } = await supabase.rpc("verify_pin", { candidate: v });
      if (!ok) { setPinErr("PIN errato."); return; }
    }
    setPin(v); setUnlocked(true); setPinModal(null);
    try { localStorage.setItem(LS_PIN, v); } catch {}
  };

  // wrapper mutazioni protette
  const guard = async (rpc: string, args: object) => {
    if (!unlocked) { openUnlock(); return; }
    const { error } = await supabase.rpc(rpc, { pin, ...args });
    if (error) {
      if (String(error.message || "").includes("PIN")) { lock(); setErr("Sessione scaduta, sblocca di nuovo."); }
      else setErr("Operazione non riuscita.");
      load();
      return;
    }
    load();
  };

  const changeWins = (coupleId: string, delta: number) => {
    if (!unlocked) { openUnlock(); return; }
    const next = Math.max(0, winsOn(selKey, coupleId) + delta);
    // ottimistico
    setDayWins((prev) => {
      const others = prev.filter((d) => !(d.played_on === selKey && d.couple_id === coupleId));
      return next > 0 ? [...others, { id: `tmp_${coupleId}`, played_on: selKey, couple_id: coupleId, wins: next }] : others;
    });
    supabase.rpc("set_day_wins", { pin, d: selKey, c_id: coupleId, w: next }).then(({ error }) => {
      if (error) { if (String(error.message || "").includes("PIN")) lock(); load(); }
    });
  };

  const addPlayer = () => { const n = newPlayer.trim(); if (!n) return; setNewPlayer(""); guard("add_player", { p_name: n }); };
  const createCouple = () => { if (!c1 || !c2 || c1 === c2) return; const a = c1, b = c2; setC1(""); setC2(""); guard("add_couple", { p1: a, p2: b }); };

  const selLabel = `${selected.getDate()} ${MESI[selected.getMonth()]} ${selected.getFullYear()}`;
  const isToday = selKey === toKey(new Date());
  const dayTotal = gamesOnDay(selKey);

  return (
    <>
      <GlobalStyle />
      <Page>
        <TopBar>
          <a href="/" style={{ textDecoration: "none" }}><BackBtn>← App</BackBtn></a>
          <Title>Classifica dal Vivo</Title>
          <LockBtn onClick={() => (unlocked ? lock() : openUnlock())} title={unlocked ? "Blocca" : "Sblocca per modificare"}>
            {unlocked ? "🔓" : "🔒"}
          </LockBtn>
        </TopBar>

        <Container>
          <Sub>Partite di briscola giocate al tavolo. Salvato online e condiviso: chiunque apra la pagina vede la stessa classifica.</Sub>
          {err && <ErrorBox onClick={() => { setErr(null); load(); }}>{err}</ErrorBox>}
          {!unlocked && !loading && (
            <LockBar onClick={openUnlock}>
              🔒 Sola lettura — {pinSet === false ? "imposta un PIN" : "inserisci il PIN"} per modificare
            </LockBar>
          )}

          {loading ? (
            <Loading>Caricamento…</Loading>
          ) : (
            <>
              {/* ===== CALENDARIO ===== */}
              <Section>
                <SectionTitle>Calendario</SectionTitle>
                <CalWrap>
                  <DayPicker
                    mode="single" required selected={selected}
                    onSelect={(d) => d && setSelected(d)}
                    locale={it} weekStartsOn={1} showOutsideDays
                    modifiers={{ played: playedDays }} modifiersClassNames={{ played: "rdp-played" }}
                  />
                </CalWrap>
              </Section>

              {/* ===== VITTORIE DEL GIORNO ===== */}
              <Section>
                <SectionTitle>
                  {selLabel}{isToday && <Oggi>OGGI</Oggi>}
                  <DayCount>{dayTotal} {dayTotal === 1 ? "partita" : "partite"}</DayCount>
                </SectionTitle>
                {activeCouples.length === 0 ? (
                  <Empty>Nessuna coppia attiva. Creane una in “Giocatori e coppie” qui sotto.</Empty>
                ) : (
                  <WinsList>
                    {activeCouples.map((c) => {
                      const v = winsOn(selKey, c.id);
                      return (
                        <WinRow key={c.id}>
                          <Dot style={{ background: colorOf(c.id) }} />
                          <WinName>{coupleLabel(c)}</WinName>
                          <Stepper>
                            <StepBtn onClick={() => changeWins(c.id, -1)} disabled={v === 0}>−</StepBtn>
                            <StepVal $on={v > 0}>{v}</StepVal>
                            <StepBtn $plus onClick={() => changeWins(c.id, 1)}>+</StepBtn>
                          </Stepper>
                        </WinRow>
                      );
                    })}
                    <WinsHint>Imposta quante partite ha vinto ogni coppia oggi.</WinsHint>
                  </WinsList>
                )}
              </Section>

              {/* ===== CLASSIFICHE ===== */}
              <ModeToggle>
                <ModeBtn $on={boardMode === "couples"} onClick={() => setBoardMode("couples")}>Coppie</ModeBtn>
                <ModeBtn $on={boardMode === "players"} onClick={() => setBoardMode("players")}>Giocatori</ModeBtn>
              </ModeToggle>
              <BoardCols>
                <Board>
                  <BoardTitle>🏆 Settimana</BoardTitle>
                  <BoardHint>{fromKey(weekStart).getDate()}–{fromKey(weekEnd).getDate()} {MESI[fromKey(weekEnd).getMonth()].slice(0, 3)}</BoardHint>
                  {weekRows.map((r, i) => (
                    <BoardRow key={r.id} $lead={i === 0}>
                      <Rank>{i + 1}</Rank><Dot style={{ background: r.color }} />
                      <BoardName>{r.label}</BoardName><BoardWins>{r.w}</BoardWins>
                    </BoardRow>
                  ))}
                  {weekRows.length === 0 && <MiniEmpty>Nessuna vittoria</MiniEmpty>}
                </Board>
                <Board>
                  <BoardTitle>📅 Mese</BoardTitle>
                  <BoardHint>{MESI[selected.getMonth()]}</BoardHint>
                  {monthRows.map((r, i) => (
                    <BoardRow key={r.id} $lead={i === 0}>
                      <Rank>{i + 1}</Rank><Dot style={{ background: r.color }} />
                      <BoardName>{r.label}</BoardName><BoardWins>{r.w}</BoardWins>
                    </BoardRow>
                  ))}
                  {monthRows.length === 0 && <MiniEmpty>Nessuna vittoria</MiniEmpty>}
                </Board>
              </BoardCols>
              <Legend>{boardMode === "players" ? "Vittorie totali del giocatore in tutte le sue coppie" : "Vittorie della coppia"}</Legend>

              {/* ===== GESTIONE ===== */}
              <ManageToggle onClick={() => setShowManage((s) => !s)}>
                {showManage ? "▲ Nascondi" : "▼ Giocatori e coppie"}
              </ManageToggle>
              {showManage && (
                <Section>
                  {!unlocked && <Empty style={{ marginBottom: 12 }}>🔒 Sblocca in alto a destra per aggiungere o rimuovere.</Empty>}
                  <SectionTitle style={{ fontSize: 16 }}>Giocatori</SectionTitle>
                  <ChipList>
                    {players.map((p) => (
                      <Chip key={p.id}>{p.name}{unlocked && <Del onClick={() => guard("delete_player", { p_id: p.id })}>×</Del>}</Chip>
                    ))}
                    {players.length === 0 && <Empty>Aggiungi i giocatori uno per uno.</Empty>}
                  </ChipList>
                  {unlocked && (
                    <AddRow>
                      <Input placeholder="Nome giocatore" value={newPlayer} maxLength={16}
                        onChange={(e) => setNewPlayer(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addPlayer()} />
                      <AddBtn onClick={addPlayer} disabled={!newPlayer.trim()}>+ Giocatore</AddBtn>
                    </AddRow>
                  )}

                  <SectionTitle style={{ fontSize: 16, marginTop: 24 }}>Coppie</SectionTitle>
                  <CoupleMngList>
                    {couples.map((c) => (
                      <CoupleMngRow key={c.id} $off={!c.active}>
                        <Dot style={{ background: colorOf(c.id) }} />
                        <span style={{ flex: 1 }}>{coupleLabel(c)}</span>
                        {unlocked && <>
                          <SmallBtn onClick={() => guard("set_couple_active", { c_id: c.id, a: !c.active })}>{c.active ? "Sospendi" : "Riattiva"}</SmallBtn>
                          <Del onClick={() => guard("delete_couple", { c_id: c.id })}>×</Del>
                        </>}
                      </CoupleMngRow>
                    ))}
                    {couples.length === 0 && <Empty>Forma una coppia scegliendo due giocatori.</Empty>}
                  </CoupleMngList>
                  {unlocked && players.length >= 2 && (
                    <AddRow>
                      <Select value={c1} onChange={(e) => setC1(e.target.value)} style={{ flex: 1 }}>
                        <option value="">Giocatore 1</option>
                        {players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </Select>
                      <Select value={c2} onChange={(e) => setC2(e.target.value)} style={{ flex: 1 }}>
                        <option value="">Giocatore 2</option>
                        {players.filter((p) => p.id !== c1).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </Select>
                      <AddBtn onClick={createCouple} disabled={!c1 || !c2 || c1 === c2}>+ Coppia</AddBtn>
                    </AddRow>
                  )}
                </Section>
              )}
            </>
          )}
        </Container>

        {/* ===== MODALE PIN ===== */}
        {pinModal && (
          <ModalScrim onClick={() => setPinModal(null)}>
            <Modal onClick={(e) => e.stopPropagation()}>
              <ModalTitle>{pinModal === "set" ? "Imposta un PIN" : "Inserisci il PIN"}</ModalTitle>
              <ModalSub>{pinModal === "set" ? "Servirà per modificare la classifica. Almeno 4 cifre." : "Per aggiungere partite, giocatori o coppie."}</ModalSub>
              <PinInput
                type="password" inputMode="numeric" autoFocus value={pinInput} placeholder="••••"
                onChange={(e) => { setPinInput(e.target.value); setPinErr(""); }}
                onKeyDown={(e) => e.key === "Enter" && submitPin()}
              />
              {pinErr && <PinErr>{pinErr}</PinErr>}
              <ModalActions>
                <ModalCancel onClick={() => setPinModal(null)}>Annulla</ModalCancel>
                <ModalOk onClick={submitPin} disabled={!pinInput.trim()}>{pinModal === "set" ? "Imposta" : "Sblocca"}</ModalOk>
              </ModalActions>
            </Modal>
          </ModalScrim>
        )}
      </Page>
    </>
  );
}

// ===== STILI =====
const GlobalStyle = createGlobalStyle`
  body { margin: 0; background: #0a120a; }
  .rdp-root {
    --rdp-accent-color: #d4a017;
    --rdp-accent-background-color: rgba(212,160,23,0.18);
    --rdp-today-color: #35a566;
    --rdp-day-width: 40px; --rdp-day-height: 40px;
    --rdp-day_button-width: 40px; --rdp-day_button-height: 40px;
    margin: 0 auto; color: #f5f0e8;
  }
  .rdp-month_caption { font-family: var(--font-display), serif; font-size: 17px; color: #f0cf7a; text-transform: capitalize; }
  .rdp-weekday { color: #77837b; font-size: 11px; text-transform: uppercase; }
  .rdp-day_button { color: #f5f0e8; font-size: 15px; border-radius: 9px; }
  .rdp-day_button:hover { background: rgba(212,160,23,0.12); }
  .rdp-outside .rdp-day_button { color: #3c463a; }
  .rdp-chevron { fill: #d4a017; }
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
  color: #f5f0e8; font-family: 'Hanken Grotesk', 'Inter', -apple-system, sans-serif; padding-bottom: 60px;
`;
const TopBar = styled.div`
  display: flex; align-items: center; justify-content: space-between; padding: 14px 16px;
  background: rgba(6,10,6,0.85); backdrop-filter: blur(10px); border-bottom: 1px solid rgba(212,160,23,0.14);
  position: sticky; top: 0; z-index: 10;
`;
const BackBtn = styled.button` background: rgba(19,33,19,0.9); border: 1px solid rgba(212,160,23,0.25); color: #d4a017; font-size: 13px; font-weight: 700; padding: 7px 12px; border-radius: 9px; cursor: pointer; `;
const LockBtn = styled.button` background: rgba(19,33,19,0.9); border: 1px solid rgba(212,160,23,0.25); font-size: 16px; padding: 6px 10px; border-radius: 9px; cursor: pointer; `;
const Title = styled.h1` font-family: var(--font-display), 'Times New Roman', serif; font-size: clamp(15px, 4.5vw, 21px); letter-spacing: 1.5px; color: #f0cf7a; margin: 0; text-align: center; `;
const Container = styled.div` max-width: 640px; margin: 0 auto; padding: 18px 16px; `;
const Sub = styled.p` color: #a09880; font-size: 14px; margin: 0 0 12px; text-align: center; `;
const ErrorBox = styled.div` background: rgba(230,57,70,0.15); border: 1px solid #e63946; color: #ff8b96; border-radius: 10px; padding: 10px 14px; font-size: 14px; margin-bottom: 12px; cursor: pointer; text-align: center; `;
const LockBar = styled.div` background: rgba(212,160,23,0.1); border: 1px solid rgba(212,160,23,0.3); color: #d4a017; border-radius: 10px; padding: 10px 14px; font-size: 13.5px; margin-bottom: 12px; cursor: pointer; text-align: center; font-weight: 600; `;
const Loading = styled.div` text-align: center; color: #a09880; padding: 40px 0; `;

const Section = styled.section` margin-top: 18px; background: rgba(19,33,19,0.55); border: 1px solid rgba(212,160,23,0.12); border-radius: 16px; padding: 18px; `;
const SectionTitle = styled.h2` font-family: var(--font-display), serif; font-size: 18px; letter-spacing: 0.5px; margin: 0 0 14px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; `;
const Oggi = styled.span` font-size: 10px; font-weight: 800; letter-spacing: 1px; background: #d4a017; color: #0a120a; padding: 2px 8px; border-radius: 6px; `;
const DayCount = styled.span` margin-left: auto; font-size: 13px; color: #a09880; font-weight: 600; `;
const CalWrap = styled.div` display: flex; justify-content: center; `;

const Empty = styled.p` color: #77837b; font-size: 14px; margin: 4px 0 0; b { color: #d4a017; } `;
const MiniEmpty = styled.p` color: #5c6659; font-size: 13px; margin: 8px 0 0; text-align: center; `;

const WinsList = styled.div` display: flex; flex-direction: column; gap: 8px; `;
const WinRow = styled.div` display: flex; align-items: center; gap: 12px; background: rgba(10,16,10,0.55); border-radius: 12px; padding: 10px 14px; `;
const WinName = styled.span` flex: 1; font-size: 15px; font-weight: 600; `;
const Stepper = styled.div` display: flex; align-items: center; gap: 6px; `;
const StepBtn = styled.button<{ $plus?: boolean }>`
  width: 36px; height: 36px; border-radius: 9px; cursor: pointer; font-size: 20px; line-height: 1;
  border: 1.5px solid ${(p) => (p.$plus ? "#d4a017" : "rgba(212,160,23,0.25)")};
  background: ${(p) => (p.$plus ? "rgba(212,160,23,0.15)" : "rgba(10,16,10,0.6)")};
  color: ${(p) => (p.$plus ? "#d4a017" : "#a09880")};
  &:disabled { opacity: 0.35; cursor: not-allowed; }
`;
const StepVal = styled.span<{ $on?: boolean }>` min-width: 30px; text-align: center; font-size: 20px; font-weight: 800; font-variant-numeric: tabular-nums; color: ${(p) => (p.$on ? "#f0cf7a" : "#5c6659")}; `;
const WinsHint = styled.p` color: #5c6659; font-size: 12px; margin: 6px 0 0; text-align: center; `;

const ModeToggle = styled.div` display: flex; gap: 6px; margin-top: 22px; background: rgba(10,16,10,0.5); padding: 4px; border-radius: 11px; `;
const ModeBtn = styled.button<{ $on?: boolean }>`
  flex: 1; padding: 9px; border-radius: 8px; border: none; cursor: pointer; font-size: 14px; font-weight: 700;
  background: ${(p) => (p.$on ? "#d4a017" : "transparent")}; color: ${(p) => (p.$on ? "#0a120a" : "#a09880")};
`;
const BoardCols = styled.div` margin-top: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 12px; @media (max-width: 520px) { grid-template-columns: 1fr; } `;
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
const Legend = styled.p` text-align: center; font-size: 11px; color: #5c6659; margin: 8px 0 0; `;

const ManageToggle = styled.button` width: 100%; margin-top: 18px; background: rgba(19,33,19,0.4); border: 1px solid rgba(212,160,23,0.12); color: #a09880; font-size: 14px; font-weight: 600; padding: 12px; border-radius: 12px; cursor: pointer; &:hover { color: #d4a017; } `;
const ChipList = styled.div` display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; `;
const Chip = styled.div` display: inline-flex; align-items: center; gap: 6px; background: rgba(10,16,10,0.7); border: 1.5px solid rgba(212,160,23,0.25); border-radius: 20px; padding: 6px 8px 6px 12px; font-size: 14px; font-weight: 600; `;
const AddRow = styled.div` display: flex; gap: 8px; flex-wrap: wrap; align-items: center; `;
const Input = styled.input` flex: 1; min-width: 120px; padding: 10px 12px; border-radius: 10px; border: 1.5px solid rgba(212,160,23,0.2); background: rgba(10,16,10,0.8); color: #f5f0e8; font-size: 15px; outline: none; &:focus { border-color: #d4a017; } &::placeholder { color: #5c6659; } `;
const Select = styled.select` padding: 10px 12px; border-radius: 10px; border: 1.5px solid rgba(212,160,23,0.2); background: rgba(10,16,10,0.8); color: #f5f0e8; font-size: 15px; outline: none; &:focus { border-color: #d4a017; } `;
const AddBtn = styled.button` background: #d4a017; color: #0a120a; border: none; padding: 10px 16px; border-radius: 10px; font-weight: 800; font-size: 14px; cursor: pointer; white-space: nowrap; &:disabled { opacity: 0.4; cursor: not-allowed; } `;
const CoupleMngList = styled.div` display: flex; flex-direction: column; gap: 7px; margin-bottom: 12px; `;
const CoupleMngRow = styled.div<{ $off?: boolean }>` display: flex; align-items: center; gap: 10px; background: rgba(10,16,10,0.5); border-radius: 10px; padding: 9px 12px; font-size: 14px; font-weight: 600; opacity: ${(p) => (p.$off ? 0.5 : 1)}; `;
const SmallBtn = styled.button` background: rgba(212,160,23,0.12); border: 1px solid rgba(212,160,23,0.3); color: #d4a017; font-size: 11px; font-weight: 700; padding: 4px 9px; border-radius: 7px; cursor: pointer; `;
const Dot = styled.span` width: 11px; height: 11px; border-radius: 50%; flex-shrink: 0; `;
const Del = styled.button` background: none; border: none; color: #77837b; font-size: 18px; line-height: 1; cursor: pointer; padding: 0 2px; &:hover { color: #e63946; } `;

const ModalScrim = styled.div` position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 20px; `;
const Modal = styled.div` background: #16211a; border: 1px solid rgba(212,160,23,0.3); border-radius: 16px; padding: 24px; width: 100%; max-width: 320px; `;
const ModalTitle = styled.h2` font-family: var(--font-display), serif; font-size: 20px; margin: 0 0 6px; color: #f0cf7a; `;
const ModalSub = styled.p` font-size: 13px; color: #a09880; margin: 0 0 16px; `;
const PinInput = styled.input` width: 100%; text-align: center; letter-spacing: 8px; font-size: 24px; padding: 12px; border-radius: 10px; border: 1.5px solid rgba(212,160,23,0.3); background: rgba(10,16,10,0.8); color: #f5f0e8; outline: none; &:focus { border-color: #d4a017; } `;
const PinErr = styled.p` color: #ff8b96; font-size: 13px; margin: 8px 0 0; text-align: center; `;
const ModalActions = styled.div` display: flex; gap: 10px; margin-top: 18px; `;
const ModalCancel = styled.button` flex: 1; padding: 11px; border-radius: 10px; border: 1.5px solid rgba(212,160,23,0.2); background: transparent; color: #a09880; font-weight: 700; font-size: 14px; cursor: pointer; `;
const ModalOk = styled.button` flex: 2; padding: 11px; border-radius: 10px; border: none; background: #d4a017; color: #0a120a; font-weight: 800; font-size: 14px; cursor: pointer; &:disabled { opacity: 0.4; cursor: not-allowed; } `;
