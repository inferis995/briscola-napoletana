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
const GIORNI = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];
const COLORS = ["#d4a017", "#2196f3", "#e63946", "#35a566", "#a06cd5", "#ff8c42", "#e0b0ff", "#4dd0c1"];
const LS_PIN = "briscola_live_pin";

type BoardMode = "couples" | "players";
type Period = "week" | "month" | "all";

export default function ClassificaDalVivo() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [couples, setCouples] = useState<Couple[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [selected, setSelected] = useState<Date>(new Date());
  const [showCal, setShowCal] = useState(false);
  const [boardMode, setBoardMode] = useState<BoardMode>("couples");
  const [period, setPeriod] = useState<Period>("week");
  const [toast, setToast] = useState("");
  const [pair, setPair] = useState<string[]>([]); // coppie selezionate per registrare
  const [h2h, setH2h] = useState<string>("");     // coppia scelta per scontri diretti
  const [h2hView, setH2hView] = useState<"one" | "all">("one");
  const [showManage, setShowManage] = useState(false);

  // PIN
  const [pinSet, setPinSet] = useState<boolean | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState("");
  const [pinModal, setPinModal] = useState<null | "set" | "enter" | "change">(null);
  const [pinInput, setPinInput] = useState("");
  const [pinErr, setPinErr] = useState("");

  const [newPlayer, setNewPlayer] = useState("");
  const [c1, setC1] = useState("");
  const [c2, setC2] = useState("");

  const load = useCallback(async () => {
    setErr(null);
    const [p, c, m] = await Promise.all([
      supabase.from("players").select("*").order("created_at"),
      supabase.from("couples").select("*").order("created_at"),
      supabase.from("matches").select("*").order("created_at"),
    ]);
    if (p.error || c.error || m.error) setErr("Errore di connessione. Tocca per riprovare.");
    else { setPlayers(p.data as Player[]); setCouples(c.data as Couple[]); setMatches(m.data as Match[]); }
    setLoading(false);
  }, []);

  const loadMeta = useCallback(async () => {
    const { data: isSet } = await supabase.rpc("pin_is_set");
    setPinSet(!!isSet);
    if (isSet) {
      let saved = ""; try { saved = localStorage.getItem(LS_PIN) || ""; } catch {}
      if (saved) { const { data: ok } = await supabase.rpc("verify_pin", { candidate: saved }); if (ok) { setPin(saved); setUnlocked(true); } }
    }
  }, []);

  useEffect(() => { load(); loadMeta(); }, [load, loadMeta]);

  // Aggiornamento in tempo reale: se qualcuno modifica da un altro
  // dispositivo, la classifica si aggiorna da sola su tutti.
  useEffect(() => {
    const ch = supabase
      .channel("classifica-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "players" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "couples" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const flash = (m: string) => { setToast(m); window.setTimeout(() => setToast(""), 1600); };

  // ===== DERIVATI =====
  const playerName = useCallback((id: string) => players.find((p) => p.id === id)?.name || "?", [players]);
  const coupleLabel = useCallback((c: Couple) => `${playerName(c.player1_id)} & ${playerName(c.player2_id)}`, [playerName]);
  const labelById = useCallback((id: string) => { const c = couples.find((x) => x.id === id); return c ? coupleLabel(c) : "?"; }, [couples, coupleLabel]);
  const colorOf = (id: string) => COLORS[Math.max(0, couples.findIndex((c) => c.id === id)) % COLORS.length];
  const activeCouples = couples.filter((c) => c.active);

  const selKey = toKey(selected);
  const dayMatches = matches.filter((m) => m.played_on === selKey);
  const playedDays = useMemo(() => Array.from(new Set(matches.map((m) => m.played_on))).map(fromKey), [matches]);

  const weekStart = toKey(mondayOf(selected));
  const weekEnd = toKey(addDays(mondayOf(selected), 6));
  const inWeek = (d: string) => d >= weekStart && d <= weekEnd;
  const monthPrefix = `${selected.getFullYear()}-${pad(selected.getMonth() + 1)}`;
  const inMonth = (d: string) => d.startsWith(monthPrefix);

  const coupleBoard = (r: (d: string) => boolean) =>
    couples.map((c) => {
      const w = matches.filter((m) => r(m.played_on) && m.winner_couple_id === c.id).length;
      const g = matches.filter((m) => r(m.played_on) && (m.winner_couple_id === c.id || m.loser_couple_id === c.id)).length;
      return { id: c.id, label: coupleLabel(c), color: colorOf(c.id), w, g };
    }).filter((x) => x.g > 0).sort((a, b) => b.w - a.w || b.g - a.g);

  const playerBoard = (r: (d: string) => boolean) =>
    players.map((p) => {
      const ids = couples.filter((c) => c.player1_id === p.id || c.player2_id === p.id).map((c) => c.id);
      const w = matches.filter((m) => r(m.played_on) && ids.includes(m.winner_couple_id)).length;
      const g = matches.filter((m) => r(m.played_on) && (ids.includes(m.winner_couple_id) || ids.includes(m.loser_couple_id))).length;
      return { id: p.id, label: p.name, color: "#d4a017", w, g };
    }).filter((x) => x.g > 0).sort((a, b) => b.w - a.w || b.g - a.g);

  const boardFn = boardMode === "couples" ? coupleBoard : playerBoard;
  const rangeFn = period === "week" ? inWeek : period === "month" ? inMonth : () => true;
  const boardRows = useMemo(() => boardFn(rangeFn), [boardMode, period, couples, players, matches, weekStart, weekEnd, monthPrefix]); // eslint-disable-line

  // Scontri diretti (all-time) della coppia scelta
  const h2hId = h2h || activeCouples[0]?.id || couples[0]?.id || "";
  const h2hRows = useMemo(() => {
    if (!h2hId) return [];
    return couples.filter((c) => c.id !== h2hId).map((o) => {
      const w = matches.filter((m) => m.winner_couple_id === h2hId && m.loser_couple_id === o.id).length;
      const l = matches.filter((m) => m.winner_couple_id === o.id && m.loser_couple_id === h2hId).length;
      return { id: o.id, label: coupleLabel(o), color: colorOf(o.id), w, l };
    }).filter((x) => x.w + x.l > 0).sort((a, b) => (b.w + b.l) - (a.w + a.l));
  }, [h2hId, couples, matches, coupleLabel]); // eslint-disable-line

  // Tutti gli scontri: ogni coppia di coppie che ha giocato, punteggio unico
  const allH2h = useMemo(() => {
    const rows: { key: string; aLabel: string; bLabel: string; aColor: string; bColor: string; aw: number; bw: number }[] = [];
    for (let i = 0; i < couples.length; i++) {
      for (let j = i + 1; j < couples.length; j++) {
        const a = couples[i], b = couples[j];
        const aw = matches.filter((m) => m.winner_couple_id === a.id && m.loser_couple_id === b.id).length;
        const bw = matches.filter((m) => m.winner_couple_id === b.id && m.loser_couple_id === a.id).length;
        if (aw + bw > 0) rows.push({ key: a.id + b.id, aLabel: coupleLabel(a), bLabel: coupleLabel(b), aColor: colorOf(a.id), bColor: colorOf(b.id), aw, bw });
      }
    }
    return rows.sort((x, y) => (y.aw + y.bw) - (x.aw + x.bw));
  }, [couples, matches, coupleLabel]); // eslint-disable-line

  // ===== PIN =====
  const lock = () => { setUnlocked(false); setPin(""); try { localStorage.removeItem(LS_PIN); } catch {} };
  const openUnlock = () => { setPinInput(""); setPinErr(""); setPinModal(pinSet ? "enter" : "set"); };
  const submitPin = async () => {
    const v = pinInput.trim();
    if (pinModal === "change") {
      if (v.length < 4) { setPinErr("Almeno 4 cifre."); return; }
      const { data: ok } = await supabase.rpc("change_pin", { old_pin: pin, new_pin: v });
      if (!ok) { setPinErr("Cambio non riuscito."); return; }
      setPin(v); setPinModal(null); flash("✓ PIN aggiornato");
      try { localStorage.setItem(LS_PIN, v); } catch {}
      return;
    }
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

  const guard = async (rpc: string, args: object) => {
    if (!unlocked) { openUnlock(); return; }
    const { error } = await supabase.rpc(rpc, { pin, ...args });
    if (error) {
      if (String(error.message || "").includes("PIN")) { lock(); setErr("Sessione scaduta, sblocca di nuovo."); }
      else setErr("Operazione non riuscita.");
    }
    load();
  };

  // Selezione rapida coppie per registrare
  const tapCouple = (id: string) => {
    setPair((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return [id];
      return [...prev, id];
    });
  };
  const recordWin = (winner: string, loser: string) => {
    if (!unlocked) { openUnlock(); return; }
    supabase.rpc("add_match", { pin, d: selKey, winner, loser }).then(({ error }) => {
      if (error) { if (String(error.message || "").includes("PIN")) lock(); setErr("Non riuscito."); }
      else { setPair([]); flash("✓ Partita registrata"); }
      load();
    });
  };

  const addPlayer = () => { const n = newPlayer.trim(); if (!n) return; setNewPlayer(""); guard("add_player", { p_name: n }); };
  const createCouple = () => { if (!c1 || !c2 || c1 === c2) return; const a = c1, b = c2; setC1(""); setC2(""); guard("add_couple", { p1: a, p2: b }); };

  const isToday = selKey === toKey(new Date());
  const dow = GIORNI[(selected.getDay() + 6) % 7];

  return (
    <>
      <GlobalStyle />
      <Page>
        <TopBar>
          <a href="/" style={{ textDecoration: "none" }}><BackBtn>← App</BackBtn></a>
          <Title>Classifica</Title>
          <LockBtn onClick={() => (unlocked ? lock() : openUnlock())} title={unlocked ? "Blocca" : "Sblocca"}>{unlocked ? "🔓" : "🔒"}</LockBtn>
        </TopBar>

        <Container>
          {err && <ErrorBox onClick={() => { setErr(null); load(); }}>{err}</ErrorBox>}
          {!unlocked && !loading && (
            <LockBar onClick={openUnlock}>🔒 Sola lettura — {pinSet === false ? "imposta un PIN" : "inserisci il PIN"} per registrare</LockBar>
          )}

          <a href="/tornei" style={{ textDecoration: "none" }}>
            <TorneiBtn>🏆 Tornei</TorneiBtn>
          </a>

          {loading ? <Loading>Caricamento…</Loading> : (
            <>
              {/* ===== NAV GIORNO ===== */}
              <DayNav>
                <NavArrow onClick={() => setSelected((d) => addDays(d, -1))}>‹</NavArrow>
                <DayCenter onClick={() => setShowCal((s) => !s)}>
                  <DayBig>{dow} {selected.getDate()}{isToday && <Oggi>OGGI</Oggi>}</DayBig>
                  <DaySmall>{MESI[selected.getMonth()]} {selected.getFullYear()} · {dayMatches.length} {dayMatches.length === 1 ? "partita" : "partite"} 📅</DaySmall>
                </DayCenter>
                <NavArrow onClick={() => setSelected((d) => addDays(d, 1))}>›</NavArrow>
              </DayNav>
              {showCal && (
                <CalCard>
                  <DayPicker mode="single" required selected={selected}
                    onSelect={(d) => { if (d) { setSelected(d); setShowCal(false); } }}
                    locale={it} weekStartsOn={1} showOutsideDays
                    modifiers={{ played: playedDays }} modifiersClassNames={{ played: "rdp-played" }} />
                </CalCard>
              )}

              {/* ===== REGISTRA PARTITA ===== */}
              <Section>
                <SectionTitle>Registra partita</SectionTitle>
                {activeCouples.length < 2 ? (
                  <Empty>Servono almeno <b>due coppie attive</b>. Creale in “Giocatori e coppie”.</Empty>
                ) : pair.length < 2 ? (
                  <>
                    <StepHint>{pair.length === 0 ? "1 · Tocca le due coppie che hanno giocato" : "Tocca la seconda coppia"}</StepHint>
                    <ChipGrid>
                      {activeCouples.map((c) => {
                        const on = pair.includes(c.id);
                        return (
                          <CoupleChip key={c.id} $on={on} $color={colorOf(c.id)} onClick={() => tapCouple(c.id)}>
                            <Dot style={{ background: colorOf(c.id) }} />{coupleLabel(c)}
                          </CoupleChip>
                        );
                      })}
                    </ChipGrid>
                  </>
                ) : (
                  <WinnerPick>
                    <StepHint>2 · Tocca la coppia che ha VINTO 🏆</StepHint>
                    <WinBtns>
                      <WinBtn $color={colorOf(pair[0])} onClick={() => recordWin(pair[0], pair[1])}>
                        <Dot style={{ background: colorOf(pair[0]) }} />{labelById(pair[0])}
                      </WinBtn>
                      <Vs>oppure</Vs>
                      <WinBtn $color={colorOf(pair[1])} onClick={() => recordWin(pair[1], pair[0])}>
                        <Dot style={{ background: colorOf(pair[1]) }} />{labelById(pair[1])}
                      </WinBtn>
                    </WinBtns>
                    <ClearBtn onClick={() => setPair([])}>← Cambia coppie</ClearBtn>
                  </WinnerPick>
                )}

                {dayMatches.length > 0 && (
                  <MatchList>
                    {dayMatches.map((m) => (
                      <MatchRow key={m.id}>
                        <Dot style={{ background: colorOf(m.winner_couple_id) }} />
                        <MatchText><b>{labelById(m.winner_couple_id)}</b> batte {labelById(m.loser_couple_id)}</MatchText>
                        {unlocked && <Del onClick={() => guard("delete_match", { m_id: m.id })}>×</Del>}
                      </MatchRow>
                    ))}
                  </MatchList>
                )}
              </Section>

              {/* ===== CLASSIFICHE ===== */}
              <ModeToggle>
                <ModeBtn $on={boardMode === "couples"} onClick={() => setBoardMode("couples")}>Coppie</ModeBtn>
                <ModeBtn $on={boardMode === "players"} onClick={() => setBoardMode("players")}>Giocatori</ModeBtn>
              </ModeToggle>
              <ModeToggle style={{ marginTop: 8 }}>
                <ModeBtn $on={period === "week"} onClick={() => setPeriod("week")}>Settimana</ModeBtn>
                <ModeBtn $on={period === "month"} onClick={() => setPeriod("month")}>Mese</ModeBtn>
                <ModeBtn $on={period === "all"} onClick={() => setPeriod("all")}>Sempre</ModeBtn>
              </ModeToggle>
              <Board style={{ marginTop: 12 }}>
                <BoardTitle>
                  {period === "week" ? "🏆 Settimana" : period === "month" ? "📅 Mese" : "⭐ Sempre"}
                </BoardTitle>
                <BoardHint>
                  {period === "week"
                    ? `${fromKey(weekStart).getDate()}–${fromKey(weekEnd).getDate()} ${MESI[fromKey(weekEnd).getMonth()].slice(0, 3)}`
                    : period === "month" ? MESI[selected.getMonth()] : "storico completo"}
                </BoardHint>
                {boardRows.length > 0 && <ColHead>vinte / giocate</ColHead>}
                {boardRows.map((r, i) => (
                  <BoardRow key={r.id} $lead={i === 0}>
                    <Rank>{i + 1}</Rank><Dot style={{ background: r.color }} />
                    <BoardName>{r.label}</BoardName><BoardWins>{r.w}<Games>/{r.g}</Games></BoardWins>
                  </BoardRow>
                ))}
                {boardRows.length === 0 && <MiniEmpty>Nessuna partita in questo periodo</MiniEmpty>}
              </Board>
              <Legend>Vinte / giocate · {boardMode === "players" ? "somma di tutte le coppie del giocatore" : "per coppia"}</Legend>

              {/* ===== SCONTRI DIRETTI ===== */}
              {couples.length >= 2 && (
                <Section>
                  <SectionTitle>Scontri diretti</SectionTitle>
                  <ModeToggle>
                    <ModeBtn $on={h2hView === "one"} onClick={() => setH2hView("one")}>La mia coppia</ModeBtn>
                    <ModeBtn $on={h2hView === "all"} onClick={() => setH2hView("all")}>Tutti gli scontri</ModeBtn>
                  </ModeToggle>

                  {h2hView === "one" ? (
                    <div style={{ marginTop: 14 }}>
                      <H2hLabel>Bilancio di</H2hLabel>
                      <H2hSelect value={h2hId} onChange={(e) => setH2h(e.target.value)}>
                        {couples.map((c) => <option key={c.id} value={c.id}>{coupleLabel(c)}</option>)}
                      </H2hSelect>
                      {h2hRows.length === 0 ? (
                        <MiniEmpty>Questa coppia non ha ancora giocato scontri</MiniEmpty>
                      ) : (
                        <H2hList>
                          {h2hRows.map((r) => (
                            <H2hRow key={r.id}>
                              <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8 }}>
                                <VsTag>vs</VsTag><Dot style={{ background: r.color }} /><H2hName>{r.label}</H2hName>
                              </div>
                              <H2hStats>
                                <Stat $c="#f0cf7a"><b>{r.w}</b><small>vinte</small></Stat>
                                <Stat $c="#ff8b96"><b>{r.l}</b><small>perse</small></Stat>
                              </H2hStats>
                            </H2hRow>
                          ))}
                        </H2hList>
                      )}
                      <Legend style={{ marginTop: 10 }}>Per ogni avversaria: vinte – perse della coppia scelta (storico)</Legend>
                    </div>
                  ) : (
                    <div style={{ marginTop: 14 }}>
                      {allH2h.length === 0 ? (
                        <MiniEmpty>Nessuno scontro registrato</MiniEmpty>
                      ) : (
                        <MatchupList>
                          {allH2h.map((r) => (
                            <MatchupRow key={r.key}>
                              <MTeam $win={r.aw > r.bw} style={{ textAlign: "right" }}>
                                <MDot style={{ background: r.aColor }} />{r.aLabel}
                              </MTeam>
                              <MScore>
                                <MNum style={{ color: r.aColor }} $win={r.aw > r.bw}>{r.aw}</MNum>
                                <span>–</span>
                                <MNum style={{ color: r.bColor }} $win={r.bw > r.aw}>{r.bw}</MNum>
                              </MScore>
                              <MTeam $win={r.bw > r.aw}>
                                {r.bLabel}<MDot style={{ background: r.bColor }} />
                              </MTeam>
                            </MatchupRow>
                          ))}
                        </MatchupList>
                      )}
                      <Legend style={{ marginTop: 10 }}>Punteggio dello scontro tra le due coppie (storico)</Legend>
                    </div>
                  )}
                </Section>
              )}

              {/* ===== GESTIONE ===== */}
              <ManageToggle onClick={() => setShowManage((s) => !s)}>{showManage ? "▲ Nascondi" : "▼ Giocatori e coppie"}</ManageToggle>
              {showManage && (
                <Section>
                  {!unlocked && <Empty style={{ marginBottom: 12 }}>🔒 Sblocca in alto a destra per modificare.</Empty>}
                  {unlocked && (
                    <SmallBtn style={{ marginBottom: 14 }} onClick={() => { setPinInput(""); setPinErr(""); setPinModal("change"); }}>🔑 Cambia PIN</SmallBtn>
                  )}
                  <SectionTitle style={{ fontSize: 16 }}>Giocatori</SectionTitle>
                  <ChipList>
                    {players.map((p) => <Chip key={p.id}>{p.name}{unlocked && <Del onClick={() => guard("delete_player", { p_id: p.id })}>×</Del>}</Chip>)}
                    {players.length === 0 && <Empty>Aggiungi i giocatori uno per uno.</Empty>}
                  </ChipList>
                  {unlocked && (
                    <AddRow>
                      <Input placeholder="Nome giocatore" value={newPlayer} maxLength={16} onChange={(e) => setNewPlayer(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addPlayer()} />
                      <AddBtn onClick={addPlayer} disabled={!newPlayer.trim()}>+ Giocatore</AddBtn>
                    </AddRow>
                  )}
                  <SectionTitle style={{ fontSize: 16, marginTop: 24 }}>Coppie</SectionTitle>
                  <CoupleMngList>
                    {couples.map((c) => (
                      <CoupleMngRow key={c.id} $off={!c.active}>
                        <Dot style={{ background: colorOf(c.id) }} /><span style={{ flex: 1 }}>{coupleLabel(c)}</span>
                        {unlocked && <><SmallBtn onClick={() => guard("set_couple_active", { c_id: c.id, a: !c.active })}>{c.active ? "Sospendi" : "Riattiva"}</SmallBtn><Del onClick={() => guard("delete_couple", { c_id: c.id })}>×</Del></>}
                      </CoupleMngRow>
                    ))}
                    {couples.length === 0 && <Empty>Forma una coppia scegliendo due giocatori.</Empty>}
                  </CoupleMngList>
                  {unlocked && players.length >= 2 && (
                    <AddRow>
                      <Select value={c1} onChange={(e) => setC1(e.target.value)} style={{ flex: 1 }}><option value="">Giocatore 1</option>{players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
                      <Select value={c2} onChange={(e) => setC2(e.target.value)} style={{ flex: 1 }}><option value="">Giocatore 2</option>{players.filter((p) => p.id !== c1).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
                      <AddBtn onClick={createCouple} disabled={!c1 || !c2 || c1 === c2}>+ Coppia</AddBtn>
                    </AddRow>
                  )}
                </Section>
              )}
            </>
          )}
        </Container>

        {toast && <Toast>{toast}</Toast>}

        {pinModal && (
          <ModalScrim onClick={() => setPinModal(null)}>
            <Modal onClick={(e) => e.stopPropagation()}>
              <ModalTitle>{pinModal === "set" ? "Imposta un PIN" : pinModal === "change" ? "Nuovo PIN" : "Inserisci il PIN"}</ModalTitle>
              <ModalSub>{pinModal === "set" ? "Servirà per modificare la classifica. Almeno 4 cifre." : pinModal === "change" ? "Scegli il nuovo PIN (almeno 4 cifre)." : "Per registrare partite, giocatori o coppie."}</ModalSub>
              <PinInput type="password" inputMode="numeric" autoFocus value={pinInput} placeholder="••••" onChange={(e) => { setPinInput(e.target.value); setPinErr(""); }} onKeyDown={(e) => e.key === "Enter" && submitPin()} />
              {pinErr && <PinErr>{pinErr}</PinErr>}
              <ModalActions>
                <ModalCancel onClick={() => setPinModal(null)}>Annulla</ModalCancel>
                <ModalOk onClick={submitPin} disabled={!pinInput.trim()}>{pinModal === "set" ? "Imposta" : pinModal === "change" ? "Salva" : "Sblocca"}</ModalOk>
              </ModalActions>
            </Modal>
          </ModalScrim>
        )}
      </Page>
    </>
  );
}

// ===== STILI =====
const Toast = styled.div`
  position: fixed; left: 50%; bottom: 28px; transform: translateX(-50%);
  background: #14522f; color: #f5f0e8; border: 1px solid #35a566;
  padding: 12px 22px; border-radius: 12px; font-size: 15px; font-weight: 700;
  z-index: 200; box-shadow: 0 8px 30px rgba(0,0,0,0.6);
  animation: toastIn 180ms ease-out;
  @keyframes toastIn { from { opacity: 0; transform: translateX(-50%) translateY(12px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
`;

const GlobalStyle = createGlobalStyle`
  body { margin: 0; background: #0a120a; }
  .rdp-root { --rdp-accent-color: #d4a017; --rdp-accent-background-color: rgba(212,160,23,0.18); --rdp-today-color: #35a566; --rdp-day-width: 40px; --rdp-day-height: 40px; --rdp-day_button-width: 40px; --rdp-day_button-height: 40px; margin: 0 auto; color: #f5f0e8; }
  .rdp-month_caption { font-family: var(--font-display), serif; font-size: 17px; color: #f0cf7a; text-transform: capitalize; }
  .rdp-weekday { color: #77837b; font-size: 11px; text-transform: uppercase; }
  .rdp-day_button { color: #f5f0e8; font-size: 15px; border-radius: 9px; }
  .rdp-day_button:hover { background: rgba(212,160,23,0.12); }
  .rdp-outside .rdp-day_button { color: #3c463a; }
  .rdp-chevron { fill: #d4a017; }
  .rdp-played .rdp-day_button { position: relative; font-weight: 700; }
  .rdp-played .rdp-day_button::after { content: ''; position: absolute; bottom: 4px; left: 50%; transform: translateX(-50%); width: 5px; height: 5px; border-radius: 50%; background: #d4a017; }
  .rdp-selected .rdp-day_button { border: 1.5px solid #d4a017; background: rgba(212,160,23,0.18); }
`;

const Page = styled.div` min-height: 100dvh; background: radial-gradient(ellipse at 50% 0%, #12240f 0%, #0a120a 60%); color: #f5f0e8; font-family: 'Hanken Grotesk', 'Inter', -apple-system, sans-serif; padding-bottom: 60px; `;
const TopBar = styled.div` display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; background: rgba(6,10,6,0.85); backdrop-filter: blur(10px); border-bottom: 1px solid rgba(212,160,23,0.14); position: sticky; top: 0; z-index: 10; `;
const BackBtn = styled.button` background: rgba(19,33,19,0.9); border: 1px solid rgba(212,160,23,0.25); color: #d4a017; font-size: 13px; font-weight: 700; padding: 7px 12px; border-radius: 9px; cursor: pointer; `;
const LockBtn = styled.button` background: rgba(19,33,19,0.9); border: 1px solid rgba(212,160,23,0.25); font-size: 16px; padding: 6px 10px; border-radius: 9px; cursor: pointer; `;
const Title = styled.h1` font-family: var(--font-display), 'Times New Roman', serif; font-size: clamp(16px, 5vw, 22px); letter-spacing: 2px; color: #f0cf7a; margin: 0; `;
const Container = styled.div` max-width: 640px; margin: 0 auto; padding: 16px; `;
const ErrorBox = styled.div` background: rgba(230,57,70,0.15); border: 1px solid #e63946; color: #ff8b96; border-radius: 10px; padding: 10px 14px; font-size: 14px; margin-bottom: 12px; cursor: pointer; text-align: center; `;
const LockBar = styled.div` background: rgba(212,160,23,0.1); border: 1px solid rgba(212,160,23,0.3); color: #d4a017; border-radius: 10px; padding: 10px 14px; font-size: 13.5px; margin-bottom: 12px; cursor: pointer; text-align: center; font-weight: 600; `;
const TorneiBtn = styled.button` width: 100%; background: rgba(212,160,23,0.12); border: 1.5px solid rgba(212,160,23,0.4); color: #f0cf7a; font-size: 15px; font-weight: 800; letter-spacing: 0.5px; padding: 13px; border-radius: 12px; cursor: pointer; &:hover { background: rgba(212,160,23,0.2); } `;
const Loading = styled.div` text-align: center; color: #a09880; padding: 40px 0; `;

const DayNav = styled.div` display: flex; align-items: center; gap: 8px; background: rgba(19,33,19,0.6); border: 1px solid rgba(212,160,23,0.14); border-radius: 14px; padding: 8px; `;
const NavArrow = styled.button` width: 44px; height: 48px; flex-shrink: 0; border-radius: 10px; background: rgba(10,16,10,0.6); border: 1px solid rgba(212,160,23,0.18); color: #d4a017; font-size: 24px; cursor: pointer; line-height: 1; `;
const DayCenter = styled.button` flex: 1; background: none; border: none; cursor: pointer; color: #f5f0e8; text-align: center; padding: 4px; `;
const DayBig = styled.div` font-family: var(--font-display), serif; font-size: 19px; font-weight: 700; letter-spacing: 0.5px; display: flex; align-items: center; justify-content: center; gap: 8px; `;
const DaySmall = styled.div` font-size: 12px; color: #a09880; margin-top: 2px; text-transform: capitalize; `;
const Oggi = styled.span` font-size: 10px; font-weight: 800; letter-spacing: 1px; background: #d4a017; color: #0a120a; padding: 2px 7px; border-radius: 6px; `;
const CalCard = styled.div` margin-top: 10px; background: rgba(19,33,19,0.6); border: 1px solid rgba(212,160,23,0.14); border-radius: 14px; padding: 10px; display: flex; justify-content: center; `;

const Section = styled.section` margin-top: 14px; background: rgba(19,33,19,0.55); border: 1px solid rgba(212,160,23,0.12); border-radius: 16px; padding: 16px; `;
const SectionTitle = styled.h2` font-family: var(--font-display), serif; font-size: 17px; letter-spacing: 0.5px; margin: 0 0 12px; `;
const Empty = styled.p` color: #77837b; font-size: 14px; margin: 4px 0 0; b { color: #d4a017; } `;
const MiniEmpty = styled.p` color: #5c6659; font-size: 13px; margin: 8px 0; text-align: center; `;
const StepHint = styled.p` font-size: 13px; color: #d4a017; font-weight: 600; margin: 0 0 10px; text-align: center; `;

const ChipGrid = styled.div` display: grid; grid-template-columns: 1fr 1fr; gap: 8px; @media (max-width: 380px) { grid-template-columns: 1fr; } `;
const CoupleChip = styled.button<{ $on?: boolean; $color: string }>`
  display: flex; align-items: center; gap: 8px; text-align: left; padding: 13px 12px; border-radius: 12px; cursor: pointer;
  font-size: 14px; font-weight: 600; color: #f5f0e8; transition: all 120ms;
  background: ${(p) => (p.$on ? `${p.$color}22` : "rgba(10,16,10,0.6)")};
  border: 2px solid ${(p) => (p.$on ? p.$color : "rgba(212,160,23,0.12)")};
`;
const WinnerPick = styled.div` display: flex; flex-direction: column; gap: 10px; `;
const WinBtns = styled.div` display: flex; flex-direction: column; gap: 8px; align-items: stretch; `;
const WinBtn = styled.button<{ $color: string }>`
  display: flex; align-items: center; justify-content: center; gap: 8px; padding: 16px; border-radius: 12px; cursor: pointer;
  font-size: 16px; font-weight: 800; color: #f5f0e8; background: ${(p) => `${p.$color}20`}; border: 2px solid ${(p) => p.$color};
  &:active { transform: scale(0.98); }
`;
const Vs = styled.div` text-align: center; font-size: 12px; color: #77837b; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; `;
const ClearBtn = styled.button` background: none; border: none; color: #a09880; font-size: 13px; font-weight: 600; cursor: pointer; padding: 4px; `;

const MatchList = styled.div` display: flex; flex-direction: column; gap: 7px; margin-top: 14px; padding-top: 14px; border-top: 1px solid rgba(212,160,23,0.1); `;
const MatchRow = styled.div` display: flex; align-items: center; gap: 10px; background: rgba(10,16,10,0.5); border-radius: 10px; padding: 9px 12px; `;
const MatchText = styled.span` flex: 1; font-size: 14px; color: #d5cdb8; b { color: #f5f0e8; } `;

const ModeToggle = styled.div` display: flex; gap: 6px; margin-top: 16px; background: rgba(10,16,10,0.5); padding: 4px; border-radius: 11px; `;
const ModeBtn = styled.button<{ $on?: boolean }>` flex: 1; padding: 10px; border-radius: 8px; border: none; cursor: pointer; font-size: 14px; font-weight: 700; background: ${(p) => (p.$on ? "#d4a017" : "transparent")}; color: ${(p) => (p.$on ? "#0a120a" : "#a09880")}; `;
const Board = styled.div` background: rgba(19,33,19,0.55); border: 1px solid rgba(212,160,23,0.12); border-radius: 16px; padding: 16px; `;
const BoardTitle = styled.h3` font-family: var(--font-display), serif; font-size: 15px; margin: 0; letter-spacing: 0.5px; `;
const BoardHint = styled.div` font-size: 11px; color: #77837b; margin: 2px 0 12px; text-transform: capitalize; `;
const ColHead = styled.div` font-size: 9px; color: #5c6659; text-transform: uppercase; letter-spacing: 0.5px; text-align: right; margin: -6px 0 6px; font-weight: 700; `;
const BoardRow = styled.div<{ $lead?: boolean }>` display: flex; align-items: center; gap: 9px; padding: 8px 9px; border-radius: 9px; margin-bottom: 5px; background: ${(p) => (p.$lead ? "rgba(212,160,23,0.12)" : "rgba(10,16,10,0.5)")}; border: 1px solid ${(p) => (p.$lead ? "rgba(212,160,23,0.4)" : "transparent")}; `;
const Rank = styled.span` width: 16px; font-size: 13px; font-weight: 800; color: #77837b; font-variant-numeric: tabular-nums; `;
const BoardName = styled.span` flex: 1; font-size: 13.5px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; `;
const BoardWins = styled.span` font-size: 19px; font-weight: 800; color: #f0cf7a; font-variant-numeric: tabular-nums; `;
const Games = styled.span` font-size: 12px; color: #77837b; font-weight: 600; `;
const Legend = styled.p` text-align: center; font-size: 11px; color: #5c6659; margin: 8px 0 0; `;

const H2hLabel = styled.div` font-size: 12px; color: #a09880; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; `;
const VsTag = styled.span` font-size: 10px; font-weight: 800; color: #77837b; text-transform: uppercase; width: 20px; flex-shrink: 0; `;
const H2hSelect = styled.select` width: 100%; padding: 11px 12px; border-radius: 10px; border: 1.5px solid rgba(212,160,23,0.2); background: rgba(10,16,10,0.8); color: #f5f0e8; font-size: 15px; font-weight: 600; outline: none; margin-bottom: 12px; &:focus { border-color: #d4a017; } `;
const H2hList = styled.div` display: flex; flex-direction: column; gap: 6px; `;
const H2hRow = styled.div` display: flex; align-items: center; gap: 10px; background: rgba(10,16,10,0.5); border-radius: 10px; padding: 10px 12px; `;
const H2hName = styled.span` flex: 1; font-size: 14px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; `;
const H2hScore = styled.span` display: flex; align-items: center; gap: 6px; font-size: 18px; font-variant-numeric: tabular-nums; span { color: #5c6659; } `;
const H2hStats = styled.div` display: flex; gap: 8px; flex-shrink: 0; `;
// Vista "Tutti gli scontri": NomeA  3 – 2  NomeB
const MatchupList = styled.div` display: flex; flex-direction: column; gap: 7px; `;
const MatchupRow = styled.div` display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 8px; background: rgba(10,16,10,0.5); border-radius: 10px; padding: 10px 10px; `;
const MTeam = styled.div<{ $win?: boolean }>`
  display: flex; align-items: center; gap: 6px; min-width: 0; font-size: 13px; line-height: 1.25;
  font-weight: ${(p) => (p.$win ? 800 : 600)}; color: ${(p) => (p.$win ? "#f5f0e8" : "#a09880")};
  ${(p) => p.$win === false ? "" : ""}
  & > * { }
`;
const MDot = styled.span` width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; `;
const MScore = styled.div` display: flex; align-items: center; gap: 6px; flex-shrink: 0; span { color: #5c6659; font-size: 15px; } `;
const MNum = styled.b<{ $win?: boolean }>` font-size: ${(p) => (p.$win ? 22 : 19)}px; font-weight: 800; font-variant-numeric: tabular-nums; line-height: 1; `;
const Stat = styled.span<{ $c: string }>`
  display: flex; flex-direction: column; align-items: center; min-width: 40px;
  background: rgba(10,16,10,0.6); border-radius: 8px; padding: 4px 8px;
  b { font-size: 18px; font-weight: 800; color: ${(p) => p.$c}; font-variant-numeric: tabular-nums; line-height: 1; }
  small { font-size: 9px; color: #77837b; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px; }
`;

const ManageToggle = styled.button` width: 100%; margin-top: 14px; background: rgba(19,33,19,0.4); border: 1px solid rgba(212,160,23,0.12); color: #a09880; font-size: 14px; font-weight: 600; padding: 13px; border-radius: 12px; cursor: pointer; &:hover { color: #d4a017; } `;
const ChipList = styled.div` display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; `;
const Chip = styled.div` display: inline-flex; align-items: center; gap: 6px; background: rgba(10,16,10,0.7); border: 1.5px solid rgba(212,160,23,0.25); border-radius: 20px; padding: 6px 8px 6px 12px; font-size: 14px; font-weight: 600; `;
const AddRow = styled.div` display: flex; gap: 8px; flex-wrap: wrap; align-items: center; `;
const Input = styled.input` flex: 1; min-width: 120px; padding: 11px 12px; border-radius: 10px; border: 1.5px solid rgba(212,160,23,0.2); background: rgba(10,16,10,0.8); color: #f5f0e8; font-size: 15px; outline: none; &:focus { border-color: #d4a017; } &::placeholder { color: #5c6659; } `;
const Select = styled.select` padding: 11px 12px; border-radius: 10px; border: 1.5px solid rgba(212,160,23,0.2); background: rgba(10,16,10,0.8); color: #f5f0e8; font-size: 15px; outline: none; &:focus { border-color: #d4a017; } `;
const AddBtn = styled.button` background: #d4a017; color: #0a120a; border: none; padding: 11px 16px; border-radius: 10px; font-weight: 800; font-size: 14px; cursor: pointer; white-space: nowrap; &:disabled { opacity: 0.4; cursor: not-allowed; } `;
const CoupleMngList = styled.div` display: flex; flex-direction: column; gap: 7px; margin-bottom: 12px; `;
const CoupleMngRow = styled.div<{ $off?: boolean }>` display: flex; align-items: center; gap: 10px; background: rgba(10,16,10,0.5); border-radius: 10px; padding: 10px 12px; font-size: 14px; font-weight: 600; opacity: ${(p) => (p.$off ? 0.5 : 1)}; `;
const SmallBtn = styled.button` background: rgba(212,160,23,0.12); border: 1px solid rgba(212,160,23,0.3); color: #d4a017; font-size: 11px; font-weight: 700; padding: 5px 10px; border-radius: 7px; cursor: pointer; `;
const Dot = styled.span` width: 11px; height: 11px; border-radius: 50%; flex-shrink: 0; `;
const Del = styled.button` background: none; border: none; color: #77837b; font-size: 20px; line-height: 1; cursor: pointer; padding: 0 4px; &:hover { color: #e63946; } `;
const ModalScrim = styled.div` position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 20px; `;
const Modal = styled.div` background: #16211a; border: 1px solid rgba(212,160,23,0.3); border-radius: 16px; padding: 24px; width: 100%; max-width: 320px; `;
const ModalTitle = styled.h2` font-family: var(--font-display), serif; font-size: 20px; margin: 0 0 6px; color: #f0cf7a; `;
const ModalSub = styled.p` font-size: 13px; color: #a09880; margin: 0 0 16px; `;
const PinInput = styled.input` width: 100%; text-align: center; letter-spacing: 8px; font-size: 24px; padding: 12px; border-radius: 10px; border: 1.5px solid rgba(212,160,23,0.3); background: rgba(10,16,10,0.8); color: #f5f0e8; outline: none; &:focus { border-color: #d4a017; } `;
const PinErr = styled.p` color: #ff8b96; font-size: 13px; margin: 8px 0 0; text-align: center; `;
const ModalActions = styled.div` display: flex; gap: 10px; margin-top: 18px; `;
const ModalCancel = styled.button` flex: 1; padding: 12px; border-radius: 10px; border: 1.5px solid rgba(212,160,23,0.2); background: transparent; color: #a09880; font-weight: 700; font-size: 14px; cursor: pointer; `;
const ModalOk = styled.button` flex: 2; padding: 12px; border-radius: 10px; border: none; background: #d4a017; color: #0a120a; font-weight: 800; font-size: 14px; cursor: pointer; &:disabled { opacity: 0.4; cursor: not-allowed; } `;
