"use client";

import { useEffect, useMemo, useState } from "react";
import styled, { createGlobalStyle } from "styled-components";

// ===== MODELLO DATI (salvato sul dispositivo) =====
interface Couple {
  id: string;
  a: string;
  b: string;
  color: string;
}
// entries[dataISO][coupleId] = partite vinte quel giorno
type Entries = { [date: string]: { [coupleId: string]: number } };

const LS_COUPLES = "briscola_live_couples";
const LS_ENTRIES = "briscola_live_entries";

const COUPLE_COLORS = ["#d4a017", "#2196f3", "#e63946", "#35a566", "#a06cd5", "#ff8c42"];

// ===== UTILITÀ DATE (ora locale) =====
const pad = (n: number) => String(n).padStart(2, "0");
const toKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
// Lunedì della settimana che contiene d
const mondayOf = (d: Date) => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (x.getDay() + 6) % 7; // 0 = lunedì
  return addDays(x, -day);
};
const GIORNI = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
const MESI = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];

export default function ClassificaDalVivo() {
  const [couples, setCouples] = useState<Couple[]>([]);
  const [entries, setEntries] = useState<Entries>({});
  const [loaded, setLoaded] = useState(false);
  const [weekStart, setWeekStart] = useState<Date>(() => mondayOf(new Date()));
  const [selectedDay, setSelectedDay] = useState<string>(() => toKey(new Date()));
  const [newA, setNewA] = useState("");
  const [newB, setNewB] = useState("");

  const todayKey = toKey(new Date());

  // Carica dal dispositivo
  useEffect(() => {
    try {
      const c = localStorage.getItem(LS_COUPLES);
      const e = localStorage.getItem(LS_ENTRIES);
      if (c) setCouples(JSON.parse(c));
      if (e) setEntries(JSON.parse(e));
    } catch {}
    setLoaded(true);
  }, []);

  // Salva sul dispositivo
  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(LS_COUPLES, JSON.stringify(couples)); } catch {}
  }, [couples, loaded]);
  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(LS_ENTRIES, JSON.stringify(entries)); } catch {}
  }, [entries, loaded]);

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );
  const weekKeys = weekDays.map(toKey);

  // Vinte da una coppia in un giorno
  const winsOn = (day: string, id: string) => entries[day]?.[id] ?? 0;
  // Totale partite registrate in un giorno (tutte le coppie)
  const gamesOn = (day: string) =>
    couples.reduce((t, c) => t + winsOn(day, c.id), 0);

  const setWins = (day: string, id: string, val: number) => {
    setEntries((prev) => {
      const dayObj = { ...(prev[day] || {}) };
      const v = Math.max(0, val);
      if (v === 0) delete dayObj[id];
      else dayObj[id] = v;
      const next = { ...prev, [day]: dayObj };
      if (Object.keys(dayObj).length === 0) delete next[day];
      return next;
    });
  };

  const addCouple = () => {
    const a = newA.trim();
    const b = newB.trim();
    if (!a || !b) return;
    const color = COUPLE_COLORS[couples.length % COUPLE_COLORS.length];
    setCouples((prev) => [
      ...prev,
      { id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, a, b, color },
    ]);
    setNewA("");
    setNewB("");
  };

  const removeCouple = (id: string) => {
    if (!confirm("Rimuovere questa coppia? I suoi punteggi verranno cancellati.")) return;
    setCouples((prev) => prev.filter((c) => c.id !== id));
    setEntries((prev) => {
      const next: Entries = {};
      for (const day of Object.keys(prev)) {
        const { [id]: _drop, ...rest } = prev[day];
        if (Object.keys(rest).length) next[day] = rest;
      }
      return next;
    });
  };

  // Totali settimana / stagione, ordinati
  const weekTotals = useMemo(() => {
    return couples
      .map((c) => ({ c, w: weekKeys.reduce((t, k) => t + winsOn(k, c.id), 0) }))
      .sort((x, y) => y.w - x.w);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [couples, entries, weekKeys.join(",")]);

  const seasonTotals = useMemo(() => {
    return couples
      .map((c) => ({
        c,
        w: Object.keys(entries).reduce((t, k) => t + winsOn(k, c.id), 0),
      }))
      .sort((x, y) => y.w - x.w);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [couples, entries]);

  const rangeLabel = `${weekDays[0].getDate()} ${MESI[weekDays[0].getMonth()]} — ${weekDays[6].getDate()} ${MESI[weekDays[6].getMonth()]}`;
  const isThisWeek = toKey(mondayOf(new Date())) === toKey(weekStart);

  const selDate = new Date(selectedDay + "T00:00:00");
  const selLabel = `${GIORNI[(selDate.getDay() + 6) % 7]} ${selDate.getDate()} ${MESI[selDate.getMonth()]}`;

  const nameOf = (c: Couple) => `${c.a} & ${c.b}`;

  return (
    <>
      <GlobalStyle />
      <Page>
        <TopBar>
          <a href="/" style={{ textDecoration: "none" }}>
            <BackBtn>← App</BackBtn>
          </a>
          <Title>Classifica dal Vivo</Title>
          <span style={{ width: 64 }} />
        </TopBar>

        <Container>
          <Sub>Segna qui le partite di briscola giocate al tavolo, a coppie. I punteggi restano su questo dispositivo.</Sub>

          {/* ===== COPPIE ===== */}
          <Section>
            <SectionTitle>Le coppie</SectionTitle>
            {couples.length === 0 && (
              <Empty>Aggiungi la prima coppia per iniziare, es. <b>Giovanni & Enzo</b>.</Empty>
            )}
            <CoupleList>
              {couples.map((c) => (
                <CoupleChip key={c.id} style={{ borderColor: c.color }}>
                  <Dot style={{ background: c.color }} />
                  {nameOf(c)}
                  <Remove onClick={() => removeCouple(c.id)} title="Rimuovi">×</Remove>
                </CoupleChip>
              ))}
            </CoupleList>
            <AddRow>
              <Input placeholder="Giocatore 1" value={newA} onChange={(e) => setNewA(e.target.value)} maxLength={14} />
              <Amp>&amp;</Amp>
              <Input placeholder="Giocatore 2" value={newB} onChange={(e) => setNewB(e.target.value)} maxLength={14}
                onKeyDown={(e) => e.key === "Enter" && addCouple()} />
              <AddBtn onClick={addCouple} disabled={!newA.trim() || !newB.trim()}>+ Coppia</AddBtn>
            </AddRow>
          </Section>

          {/* ===== CALENDARIO SETTIMANALE ===== */}
          <Section>
            <WeekHead>
              <SectionTitle style={{ margin: 0 }}>Calendario</SectionTitle>
              <WeekNav>
                <NavBtn onClick={() => setWeekStart(addDays(weekStart, -7))}>‹</NavBtn>
                <WeekRange>
                  {rangeLabel}
                  {isThisWeek && <ThisWeek>questa settimana</ThisWeek>}
                </WeekRange>
                <NavBtn onClick={() => setWeekStart(addDays(weekStart, 7))}>›</NavBtn>
              </WeekNav>
            </WeekHead>

            <WeekGrid>
              {weekDays.map((d) => {
                const key = toKey(d);
                const games = gamesOn(key);
                return (
                  <DayCell
                    key={key}
                    $today={key === todayKey}
                    $selected={key === selectedDay}
                    onClick={() => setSelectedDay(key)}
                  >
                    <DayName>{GIORNI[(d.getDay() + 6) % 7]}</DayName>
                    <DayNum>{d.getDate()}</DayNum>
                    {games > 0 ? <DayGames>{games} 🃏</DayGames> : <DayGamesEmpty>—</DayGamesEmpty>}
                  </DayCell>
                );
              })}
            </WeekGrid>
          </Section>

          {/* ===== REGISTRA IL GIORNO SELEZIONATO ===== */}
          <Section>
            <SectionTitle>
              Partite vinte · <span style={{ color: "#d4a017" }}>{selLabel}</span>
              {selectedDay === todayKey && <Oggi>OGGI</Oggi>}
            </SectionTitle>
            {couples.length === 0 ? (
              <Empty>Aggiungi almeno una coppia per registrare i punteggi.</Empty>
            ) : (
              <EntryList>
                {couples.map((c) => {
                  const v = winsOn(selectedDay, c.id);
                  return (
                    <EntryRow key={c.id}>
                      <Dot style={{ background: c.color }} />
                      <EntryName>{nameOf(c)}</EntryName>
                      <Stepper>
                        <StepBtn onClick={() => setWins(selectedDay, c.id, v - 1)} disabled={v === 0}>−</StepBtn>
                        <StepVal $on={v > 0}>{v}</StepVal>
                        <StepBtn onClick={() => setWins(selectedDay, c.id, v + 1)} $plus>+</StepBtn>
                      </Stepper>
                    </EntryRow>
                  );
                })}
              </EntryList>
            )}
          </Section>

          {/* ===== CLASSIFICHE ===== */}
          {couples.length > 0 && (
            <BoardCols>
              <Board>
                <BoardTitle>🏆 Settimana</BoardTitle>
                {weekTotals.map(({ c, w }, i) => (
                  <BoardRow key={c.id} $lead={i === 0 && w > 0}>
                    <Rank>{i + 1}</Rank>
                    <Dot style={{ background: c.color }} />
                    <BoardName>{nameOf(c)}</BoardName>
                    <BoardWins>{w}</BoardWins>
                  </BoardRow>
                ))}
              </Board>
              <Board>
                <BoardTitle>📅 Totale stagione</BoardTitle>
                {seasonTotals.map(({ c, w }, i) => (
                  <BoardRow key={c.id} $lead={i === 0 && w > 0}>
                    <Rank>{i + 1}</Rank>
                    <Dot style={{ background: c.color }} />
                    <BoardName>{nameOf(c)}</BoardName>
                    <BoardWins>{w}</BoardWins>
                  </BoardRow>
                ))}
              </Board>
            </BoardCols>
          )}
        </Container>
      </Page>
    </>
  );
}

// ===== STILI =====
const GlobalStyle = createGlobalStyle`
  body { margin: 0; background: #0a120a; }
`;

const Page = styled.div`
  min-height: 100vh;
  min-height: 100dvh;
  background: radial-gradient(ellipse at 50% 0%, #12240f 0%, #0a120a 60%);
  color: #f5f0e8;
  font-family: 'Hanken Grotesk', 'Inter', -apple-system, sans-serif;
  padding-bottom: 60px;
`;

const TopBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  background: rgba(6,10,6,0.85);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(212,160,23,0.14);
  position: sticky;
  top: 0;
  z-index: 10;
`;
const BackBtn = styled.button`
  background: rgba(19,33,19,0.9);
  border: 1px solid rgba(212,160,23,0.25);
  color: #d4a017;
  font-size: 13px;
  font-weight: 700;
  padding: 7px 12px;
  border-radius: 9px;
  cursor: pointer;
`;
const Title = styled.h1`
  font-family: var(--font-display), 'Times New Roman', serif;
  font-size: clamp(17px, 4.5vw, 22px);
  letter-spacing: 1.5px;
  color: #f0cf7a;
  margin: 0;
  text-align: center;
`;

const Container = styled.div`
  max-width: 720px;
  margin: 0 auto;
  padding: 20px 16px;
`;
const Sub = styled.p`
  color: #a09880;
  font-size: 14px;
  margin: 0 0 8px;
  text-align: center;
`;

const Section = styled.section`
  margin-top: 26px;
  background: rgba(19,33,19,0.55);
  border: 1px solid rgba(212,160,23,0.12);
  border-radius: 16px;
  padding: 18px 18px 20px;
`;
const SectionTitle = styled.h2`
  font-family: var(--font-display), serif;
  font-size: 18px;
  letter-spacing: 0.5px;
  margin: 0 0 14px;
  color: #f5f0e8;
  display: flex;
  align-items: center;
  gap: 10px;
`;
const Oggi = styled.span`
  font-family: 'Hanken Grotesk', sans-serif;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 1px;
  background: #d4a017;
  color: #0a120a;
  padding: 2px 8px;
  border-radius: 6px;
`;

const Empty = styled.p`
  color: #77837b;
  font-size: 14px;
  margin: 4px 0 0;
  b { color: #d4a017; }
`;

const CoupleList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 14px;
`;
const CoupleChip = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: rgba(10,16,10,0.7);
  border: 1.5px solid;
  border-radius: 22px;
  padding: 6px 10px 6px 12px;
  font-size: 14px;
  font-weight: 600;
`;
const Dot = styled.span`
  width: 11px; height: 11px; border-radius: 50%; flex-shrink: 0;
`;
const Remove = styled.button`
  background: none; border: none; color: #77837b; font-size: 18px; line-height: 1;
  cursor: pointer; padding: 0 2px; &:hover { color: #e63946; }
`;
const AddRow = styled.div`
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
`;
const Input = styled.input`
  flex: 1; min-width: 90px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1.5px solid rgba(212,160,23,0.2);
  background: rgba(10,16,10,0.7);
  color: #f5f0e8;
  font-size: 15px;
  outline: none;
  &:focus { border-color: #d4a017; }
  &::placeholder { color: #5c6659; }
`;
const Amp = styled.span` color: #a09880; font-weight: 700; `;
const AddBtn = styled.button`
  background: #d4a017; color: #0a120a; border: none;
  padding: 10px 16px; border-radius: 10px; font-weight: 800; font-size: 14px; cursor: pointer;
  white-space: nowrap;
  &:disabled { opacity: 0.4; cursor: not-allowed; }
`;

const WeekHead = styled.div`
  display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;
  margin-bottom: 14px;
`;
const WeekNav = styled.div` display: flex; align-items: center; gap: 8px; `;
const NavBtn = styled.button`
  width: 34px; height: 34px; border-radius: 9px;
  background: rgba(10,16,10,0.7); border: 1px solid rgba(212,160,23,0.2);
  color: #d4a017; font-size: 20px; cursor: pointer; line-height: 1;
`;
const WeekRange = styled.div`
  font-size: 14px; font-weight: 600; color: #f5f0e8; text-align: center;
  display: flex; flex-direction: column; align-items: center; min-width: 130px;
`;
const ThisWeek = styled.span` font-size: 10px; color: #35a566; letter-spacing: 0.5px; `;

const WeekGrid = styled.div`
  display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px;
`;
const DayCell = styled.button<{ $today?: boolean; $selected?: boolean }>`
  display: flex; flex-direction: column; align-items: center; gap: 3px;
  padding: 10px 2px 8px;
  border-radius: 11px;
  cursor: pointer;
  background: ${(p) => (p.$selected ? "rgba(212,160,23,0.16)" : "rgba(10,16,10,0.6)")};
  border: 1.5px solid ${(p) =>
    p.$selected ? "#d4a017" : p.$today ? "rgba(53,165,102,0.6)" : "rgba(212,160,23,0.08)"};
  transition: all 120ms;
  &:hover { border-color: rgba(212,160,23,0.5); }
`;
const DayName = styled.span` font-size: 10px; color: #a09880; text-transform: uppercase; letter-spacing: 0.5px; `;
const DayNum = styled.span` font-size: 18px; font-weight: 700; color: #f5f0e8; font-variant-numeric: tabular-nums; `;
const DayGames = styled.span` font-size: 10px; color: #d4a017; font-weight: 700; white-space: nowrap; `;
const DayGamesEmpty = styled.span` font-size: 10px; color: #3c463a; `;

const EntryList = styled.div` display: flex; flex-direction: column; gap: 8px; `;
const EntryRow = styled.div`
  display: flex; align-items: center; gap: 12px;
  background: rgba(10,16,10,0.55); border-radius: 12px; padding: 10px 14px;
`;
const EntryName = styled.span` flex: 1; font-size: 15px; font-weight: 600; `;
const Stepper = styled.div` display: flex; align-items: center; gap: 6px; `;
const StepBtn = styled.button<{ $plus?: boolean }>`
  width: 34px; height: 34px; border-radius: 9px; cursor: pointer; font-size: 20px; line-height: 1;
  border: 1.5px solid ${(p) => (p.$plus ? "#d4a017" : "rgba(212,160,23,0.25)")};
  background: ${(p) => (p.$plus ? "rgba(212,160,23,0.15)" : "rgba(10,16,10,0.6)")};
  color: ${(p) => (p.$plus ? "#d4a017" : "#a09880")};
  &:disabled { opacity: 0.35; cursor: not-allowed; }
`;
const StepVal = styled.span<{ $on?: boolean }>`
  min-width: 30px; text-align: center; font-size: 20px; font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: ${(p) => (p.$on ? "#f0cf7a" : "#5c6659")};
`;

const BoardCols = styled.div`
  margin-top: 26px; display: grid; grid-template-columns: 1fr 1fr; gap: 14px;
  @media (max-width: 560px) { grid-template-columns: 1fr; }
`;
const Board = styled.div`
  background: rgba(19,33,19,0.55); border: 1px solid rgba(212,160,23,0.12);
  border-radius: 16px; padding: 16px;
`;
const BoardTitle = styled.h3`
  font-family: var(--font-display), serif; font-size: 15px; margin: 0 0 12px; letter-spacing: 0.5px;
`;
const BoardRow = styled.div<{ $lead?: boolean }>`
  display: flex; align-items: center; gap: 10px;
  padding: 9px 10px; border-radius: 10px; margin-bottom: 6px;
  background: ${(p) => (p.$lead ? "rgba(212,160,23,0.12)" : "rgba(10,16,10,0.5)")};
  border: 1px solid ${(p) => (p.$lead ? "rgba(212,160,23,0.4)" : "transparent")};
`;
const Rank = styled.span`
  width: 18px; font-size: 13px; font-weight: 800; color: #77837b; font-variant-numeric: tabular-nums;
`;
const BoardName = styled.span` flex: 1; font-size: 14px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; `;
const BoardWins = styled.span`
  font-size: 20px; font-weight: 800; color: #f0cf7a; font-variant-numeric: tabular-nums;
`;
