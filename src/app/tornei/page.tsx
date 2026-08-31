"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styled, { createGlobalStyle } from "styled-components";
import { supabase, Player, Couple, Tournament, TournamentTeam, TournamentMatch, TournamentFormat } from "@/lib/supabase";

const COLORS = ["#d4a017", "#2196f3", "#e63946", "#35a566", "#a06cd5", "#ff8c42", "#e0b0ff", "#4dd0c1", "#f2a5c4", "#7ec8ff", "#c0d860", "#ff7043"];
const LS_PIN = "briscola_live_pin";
const pad = (n: number) => String(n).padStart(2, "0");
const toKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const MESI = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];

type View = { t: "list" } | { t: "create" } | { t: "detail"; id: string };

export default function TorneiPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [couples, setCouples] = useState<Couple[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [teams, setTeams] = useState<TournamentTeam[]>([]);
  const [tmatches, setTmatches] = useState<TournamentMatch[]>([]);
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [view, setView] = useState<View>({ t: "list" });

  // PIN
  const [pinSet, setPinSet] = useState<boolean | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState("");
  const [pinModal, setPinModal] = useState<null | "set" | "enter">(null);
  const [pinInput, setPinInput] = useState("");
  const [pinErr, setPinErr] = useState("");

  // create form
  const [cName, setCName] = useState("");
  const [cDate, setCDate] = useState(toKey(new Date()));
  const [cMode, setCMode] = useState<"couples" | "draft">("couples");
  const [cTeams, setCTeams] = useState<string[]>([]);
  const [cPlayers, setCPlayers] = useState<string[]>([]);
  const [cFormat, setCFormat] = useState<TournamentFormat>("triangular");

  const load = useCallback(async () => {
    setErr(null);
    const [p, c, t, tt, tm, ph] = await Promise.all([
      supabase.from("players").select("*").order("created_at"),
      supabase.from("couples").select("*").order("created_at"),
      supabase.from("tournaments").select("*").order("created_at", { ascending: false }),
      supabase.from("tournament_teams").select("*"),
      supabase.from("tournament_matches").select("*"),
      supabase.from("tournament_photos").select("tournament_id, image"),
    ]);
    if (p.error || c.error || t.error || tt.error || tm.error) setErr("Errore di connessione. Tocca per riprovare.");
    else {
      setPlayers(p.data as Player[]); setCouples(c.data as Couple[]);
      setTournaments(t.data as Tournament[]); setTeams(tt.data as TournamentTeam[]); setTmatches(tm.data as TournamentMatch[]);
      const pm: Record<string, string> = {};
      (ph.data as { tournament_id: string; image: string }[] | null)?.forEach((r) => { pm[r.tournament_id] = r.image; });
      setPhotos(pm);
    }
    setLoading(false);
  }, []);

  const loadMeta = useCallback(async () => {
    const { data: isSet } = await supabase.rpc("pin_is_set");
    setPinSet(!!isSet);
    if (isSet) { let s = ""; try { s = localStorage.getItem(LS_PIN) || ""; } catch {} if (s) { const { data: ok } = await supabase.rpc("verify_pin", { candidate: s }); if (ok) { setPin(s); setUnlocked(true); } } }
  }, []);

  useEffect(() => { load(); loadMeta(); }, [load, loadMeta]);
  useEffect(() => {
    const ch = supabase.channel("tornei-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "tournaments" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "tournament_matches" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "tournament_teams" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "tournament_photos" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const flash = (m: string) => { setToast(m); window.setTimeout(() => setToast(""), 1600); };

  const shareText = async (text: string) => {
    try {
      if (typeof navigator !== "undefined" && (navigator as any).share) { await (navigator as any).share({ text }); return; }
    } catch { /* utente ha annullato o non supportato: provo la copia */ }
    try { await navigator.clipboard.writeText(text); flash("📋 Copiato — incolla su WhatsApp"); }
    catch { setErr("Copia non riuscita. Seleziona e copia manualmente."); }
  };
  const setTournamentPhoto = async (tid: string, dataUrl: string | null) => {
    const { error } = await rpc("set_tournament_photo", { tid, image_data: dataUrl ?? "" });
    if (!error) flash(dataUrl ? "📷 Foto salvata" : "Foto rimossa");
  };
  const playerName = useCallback((id: string) => players.find((p) => p.id === id)?.name || "?", [players]);
  const coupleLabel = useCallback((id: string) => { const c = couples.find((x) => x.id === id); return c ? `${playerName(c.player1_id)} & ${playerName(c.player2_id)}` : "?"; }, [couples, playerName]);
  const colorOf = (id: string) => COLORS[Math.max(0, couples.findIndex((c) => c.id === id)) % COLORS.length];
  const activeCouples = couples.filter((c) => c.active);

  // Albo d'oro: tornei vinti per coppia (solo tornei conclusi). Nessun singolo.
  const albo = useMemo(() => {
    const m = new Map<string, number>();
    tournaments.forEach((t) => { if (t.status === "done" && t.winner_couple_id) m.set(t.winner_couple_id, (m.get(t.winner_couple_id) || 0) + 1); });
    return Array.from(m.entries()).map(([id, n]) => ({ id, n })).sort((a, b) => b.n - a.n);
  }, [tournaments]);

  // PIN helpers
  const lock = () => { setUnlocked(false); setPin(""); try { localStorage.removeItem(LS_PIN); } catch {} };
  const openUnlock = () => { setPinInput(""); setPinErr(""); setPinModal(pinSet ? "enter" : "set"); };
  const submitPin = async () => {
    const v = pinInput.trim();
    if (pinModal === "set") {
      if (v.length < 4) { setPinErr("Almeno 4 cifre."); return; }
      const { data: ok } = await supabase.rpc("set_pin", { candidate: v });
      if (!ok) { setPinErr("Impossibile impostare."); loadMeta(); return; }
      setPinSet(true);
    } else {
      const { data: ok } = await supabase.rpc("verify_pin", { candidate: v });
      if (!ok) { setPinErr("PIN errato."); return; }
    }
    setPin(v); setUnlocked(true); setPinModal(null); try { localStorage.setItem(LS_PIN, v); } catch {}
  };

  const rpc = async (fn: string, args: object): Promise<any> => {
    if (!unlocked) { openUnlock(); return { error: { message: "locked" } }; }
    const res = await supabase.rpc(fn, { pin, ...args });
    if (res.error) { if (String(res.error.message || "").includes("PIN")) { lock(); setErr("Sblocca di nuovo."); } else setErr("Operazione non riuscita."); }
    return res;
  };

  // ===== CREA TORNEO =====
  const toggleTeam = (id: string) => setCTeams((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  const togglePlayer = (id: string) => setCPlayers((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  const draft = cMode === "draft";
  const nTeams = draft ? Math.floor(cPlayers.length / 2) : cTeams.length;
  const playersOk = !draft || (cPlayers.length >= 4 && cPlayers.length % 2 === 0);
  const formatOptions = useMemo(() => {
    const n = nTeams;
    const opts: { v: TournamentFormat; label: string }[] = [];
    if (n >= 2) opts.push({ v: "triangular", label: n === 2 ? "Sfida (andata/ritorno)" : n === 3 ? "Triangolare" : "Girone all'italiana" });
    if (n === 4) opts.push({ v: "knockout4", label: "Eliminazione (semifinali)" });
    if (n === 8) opts.push({ v: "knockout8", label: "Eliminazione (quarti)" });
    return opts;
  }, [nTeams]);
  useEffect(() => { if (!formatOptions.some((o) => o.v === cFormat)) setCFormat(formatOptions[0]?.v || "triangular"); }, [formatOptions]); // eslint-disable-line

  const createTournament = async () => {
    if (!cName.trim()) return;
    if (draft) {
      if (!playersOk) return;
      const { data, error } = await rpc("create_tournament_from_players", { t_name: cName.trim(), t_date: cDate, t_format: cFormat, player_ids: cPlayers });
      if (!error && data) { flash("🎲 Torneo creato — coppie sorteggiate"); setCName(""); setCPlayers([]); setCTeams([]); setView({ t: "detail", id: data as string }); }
    } else {
      if (cTeams.length < 2) return;
      const { data, error } = await rpc("create_tournament", { t_name: cName.trim(), t_date: cDate, t_format: cFormat, team_ids: cTeams });
      if (!error && data) { flash("🏆 Torneo creato"); setCName(""); setCTeams([]); setCPlayers([]); setView({ t: "detail", id: data as string }); }
    }
  };

  const setWinner = async (matchId: string, w: string) => {
    const { error } = await rpc("set_tournament_winner", { match_id: matchId, w });
    if (!error) flash("✓ Risultato salvato");
  };
  const finishManual = async (tid: string, w: string) => {
    const { error } = await rpc("finish_tournament", { tid, w });
    if (!error) flash("🏆 Campione assegnato");
  };
  const deleteTournament = async (tid: string) => {
    if (!confirm("Eliminare il torneo? Struttura e risultati verranno persi.")) return;
    const { error } = await rpc("delete_tournament", { tid });
    if (!error) { flash("Torneo eliminato"); setView({ t: "list" }); }
  };

  const detail = view.t === "detail" ? tournaments.find((t) => t.id === view.id) : null;

  return (
    <>
      <GlobalStyle />
      <Page>
        <TopBar>
          {view.t === "list"
            ? <a href="/classifica" style={{ textDecoration: "none" }}><BackBtn>← Classifica</BackBtn></a>
            : <BackBtn onClick={() => setView({ t: "list" })}>← Tornei</BackBtn>}
          <Title>Tornei</Title>
          <LockBtn onClick={() => (unlocked ? lock() : openUnlock())}>{unlocked ? "🔓" : "🔒"}</LockBtn>
        </TopBar>

        <Container>
          {err && <ErrorBox onClick={() => { setErr(null); load(); }}>{err}</ErrorBox>}
          {loading ? <Loading>Caricamento…</Loading> : (
            <>
              {/* ===== LISTA ===== */}
              {view.t === "list" && (
                <>
                  <CreateBtn onClick={() => (unlocked ? setView({ t: "create" }) : openUnlock())}>+ Crea nuovo torneo</CreateBtn>
                  {tournaments.length === 0 ? (
                    <Empty style={{ textAlign: "center", marginTop: 24 }}>Nessun torneo. Creane uno col pulsante qui sopra.</Empty>
                  ) : (
                    <List>
                      {tournaments.map((t) => (
                        <TCard key={t.id} onClick={() => setView({ t: "detail", id: t.id })}>
                          {photos[t.id] && (
                            <Thumb src={photos[t.id]} alt="Foto vincitori"
                              onClick={(e) => { e.stopPropagation(); setLightbox(photos[t.id]); }} />
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <TName>{t.name}</TName>
                            <TMeta>
                              {t.event_date ? `${fromISO(t.event_date)}` : ""} · {fmtLabel(t.format)}
                            </TMeta>
                          </div>
                          {t.status === "done" && t.winner_couple_id
                            ? <Champ>🏆 {coupleLabel(t.winner_couple_id)}</Champ>
                            : <Ongoing>in corso</Ongoing>}
                        </TCard>
                      ))}
                    </List>
                  )}

                  {albo.length > 0 && (
                    <Section>
                      <SectionTitle style={{ fontSize: 16 }}>🏅 Albo d&apos;oro</SectionTitle>
                      <ColHead>tornei vinti</ColHead>
                      {albo.map((a, i) => (
                        <BoardRow key={a.id} $lead={i === 0}>
                          <Rank>{i + 1}</Rank><Dot style={{ background: colorOf(a.id) }} />
                          <BoardName>{coupleLabel(a.id)}</BoardName>
                          <BoardWins>{a.n}<Games> 🏆</Games></BoardWins>
                        </BoardRow>
                      ))}
                      <Empty style={{ marginTop: 8, fontSize: 12 }}>Classifica tornei · solo per coppia — un trofeo per ogni torneo vinto</Empty>
                    </Section>
                  )}
                </>
              )}

              {/* ===== CREA ===== */}
              {view.t === "create" && (
                <Section>
                  <SectionTitle>Nuovo torneo</SectionTitle>
                  <Field><Label>Nome</Label><Input value={cName} maxLength={30} placeholder="Es. Torneo di Capodanno" onChange={(e) => setCName(e.target.value)} /></Field>
                  <Field><Label>Giorno</Label><Input type="date" value={cDate} onChange={(e) => setCDate(e.target.value)} /></Field>

                  <Label>Come formi le squadre</Label>
                  <ModeTabs>
                    <ModeTab $on={!draft} onClick={() => setCMode("couples")}>👥 Coppie fisse</ModeTab>
                    <ModeTab $on={draft} onClick={() => setCMode("draft")}>🎲 Sorteggio giocatori</ModeTab>
                  </ModeTabs>

                  {!draft ? (
                    <>
                      <Label style={{ marginTop: 14 }}>Squadre (tocca in ordine di testa di serie)</Label>
                      <ChipGrid>
                        {activeCouples.map((c) => {
                          const idx = cTeams.indexOf(c.id);
                          return (
                            <TeamChip key={c.id} $on={idx >= 0} $color={colorOf(c.id)} onClick={() => toggleTeam(c.id)}>
                              {idx >= 0 && <Seed>{idx + 1}</Seed>}
                              <Dot style={{ background: colorOf(c.id) }} />{coupleLabel(c.id)}
                            </TeamChip>
                          );
                        })}
                      </ChipGrid>
                    </>
                  ) : (
                    <>
                      <Label style={{ marginTop: 14 }}>Giocatori (le coppie e i tavoli li sorteggia il sistema)</Label>
                      <ChipGrid>
                        {players.map((p) => {
                          const on = cPlayers.includes(p.id);
                          return (
                            <TeamChip key={p.id} $on={on} $color="#d4a017" onClick={() => togglePlayer(p.id)}>
                              {on && <Seed>✓</Seed>}
                              <Dot style={{ background: "#d4a017" }} />{p.name}
                            </TeamChip>
                          );
                        })}
                      </ChipGrid>
                      <DraftInfo>
                        {cPlayers.length === 0 ? "Seleziona un numero pari di giocatori (minimo 4)."
                          : cPlayers.length % 2 !== 0 ? `⚠️ ${cPlayers.length} giocatori: serve un numero pari.`
                          : cPlayers.length < 4 ? "Servono almeno 4 giocatori (2 coppie)."
                          : `${cPlayers.length} giocatori → ${nTeams} coppie sorteggiate`}
                      </DraftInfo>
                    </>
                  )}

                  {nTeams >= 2 && playersOk && (
                    <>
                      <Label style={{ marginTop: 16 }}>Formato ({nTeams} squadre)</Label>
                      <FormatList>
                        {formatOptions.map((o) => (
                          <FormatOpt key={o.v} $on={cFormat === o.v} onClick={() => setCFormat(o.v)}>{o.label}</FormatOpt>
                        ))}
                      </FormatList>
                    </>
                  )}
                  <CreateBtn style={{ marginTop: 18 }} onClick={createTournament} disabled={!cName.trim() || nTeams < 2 || !playersOk}>
                    {draft ? `🎲 Sorteggia e crea (${nTeams} coppie)` : `Crea torneo con ${cTeams.length} squadre`}
                  </CreateBtn>
                </Section>
              )}

              {/* ===== DETTAGLIO ===== */}
              {view.t === "detail" && detail && (
                <TournamentDetail
                  t={detail}
                  teams={teams.filter((x) => x.tournament_id === detail.id)}
                  matches={tmatches.filter((x) => x.tournament_id === detail.id)}
                  coupleLabel={coupleLabel} colorOf={colorOf}
                  unlocked={unlocked} onWinner={setWinner} onFinish={finishManual} onDelete={deleteTournament}
                  onShare={shareText}
                  photo={photos[detail.id]} onSetPhoto={setTournamentPhoto} onOpenPhoto={setLightbox}
                />
              )}
            </>
          )}
        </Container>

        {lightbox && (
          <Lightbox onClick={() => setLightbox(null)}>
            <img src={lightbox} alt="Foto torneo" />
            <LightClose>✕</LightClose>
          </Lightbox>
        )}
        {toast && <Toast>{toast}</Toast>}
        {pinModal && (
          <ModalScrim onClick={() => setPinModal(null)}>
            <Modal onClick={(e) => e.stopPropagation()}>
              <ModalTitle>{pinModal === "set" ? "Imposta un PIN" : "Inserisci il PIN"}</ModalTitle>
              <ModalSub>{pinModal === "set" ? "Almeno 4 cifre." : "Per creare e gestire i tornei."}</ModalSub>
              <PinInput type="password" inputMode="numeric" autoFocus value={pinInput} placeholder="••••" onChange={(e) => { setPinInput(e.target.value); setPinErr(""); }} onKeyDown={(e) => e.key === "Enter" && submitPin()} />
              {pinErr && <PinErr>{pinErr}</PinErr>}
              <ModalActions><ModalCancel onClick={() => setPinModal(null)}>Annulla</ModalCancel><ModalOk onClick={submitPin} disabled={!pinInput.trim()}>{pinModal === "set" ? "Imposta" : "Sblocca"}</ModalOk></ModalActions>
            </Modal>
          </ModalScrim>
        )}
      </Page>
    </>
  );
}

// ===== DETTAGLIO TORNEO =====
function TournamentDetail({ t, teams, matches, coupleLabel, colorOf, unlocked, onWinner, onFinish, onDelete, onShare, photo, onSetPhoto, onOpenPhoto }: {
  t: Tournament; teams: TournamentTeam[]; matches: TournamentMatch[];
  coupleLabel: (id: string) => string; colorOf: (id: string) => string;
  unlocked: boolean; onWinner: (m: string, w: string) => void; onFinish: (tid: string, w: string) => void; onDelete: (tid: string) => void;
  onShare: (text: string) => void;
  photo?: string; onSetPhoto: (tid: string, dataUrl: string | null) => void; onOpenPhoto: (url: string) => void;
}) {
  const isKnockout = t.format !== "triangular";
  const [manual, setManual] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { setBusy(true); try { onSetPhoto(t.id, await fileToDataUrl(f)); } catch { /* immagine non valida */ } setBusy(false); }
    e.target.value = "";
  };

  const standings = useMemo(() => teams.map((tm) => {
    const w = matches.filter((m) => m.winner === tm.couple_id).length;
    const g = matches.filter((m) => m.team_a === tm.couple_id || m.team_b === tm.couple_id).length;
    return { id: tm.couple_id, w, g };
  }).sort((a, b) => b.w - a.w || b.g - a.g), [teams, matches]);

  const rounds = useMemo(() => {
    const map = new Map<number, TournamentMatch[]>();
    matches.forEach((m) => { const a = map.get(m.round) || []; a.push(m); map.set(m.round, a); });
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]).map(([r, ms]) => [r, ms.sort((x, y) => x.position - y.position)] as [number, TournamentMatch[]]);
  }, [matches]);

  const allDecided = matches.length > 0 && matches.every((m) => m.winner);

  return (
    <>
      <DetailHead>
        <div>
          <SectionTitle style={{ margin: 0 }}>{t.name}</SectionTitle>
          <TMeta>{t.event_date ? fromISO(t.event_date) + " · " : ""}{fmtLabel(t.format)}</TMeta>
        </div>
        {t.status === "done" && <StatusPill $done>Concluso</StatusPill>}
      </DetailHead>

      {t.status === "done" && t.winner_couple_id && (
        <ChampBanner><span>🏆 CAMPIONE</span><b>{coupleLabel(t.winner_couple_id)}</b></ChampBanner>
      )}

      <ShareBtn onClick={() => onShare(buildExport(t, teams, matches, coupleLabel))}>
        📤 Esporta per WhatsApp
      </ShareBtn>

      <PhotoZone>
        {photo ? (
          <>
            <PhotoImg src={photo} alt="Foto vincitori" onClick={() => onOpenPhoto(photo)} />
            {unlocked && (
              <PhotoActions>
                <SmallGhost onClick={() => fileRef.current?.click()} disabled={busy}>{busy ? "…" : "📷 Cambia foto"}</SmallGhost>
                <SmallGhost $danger onClick={() => onSetPhoto(t.id, null)}>Rimuovi</SmallGhost>
              </PhotoActions>
            )}
          </>
        ) : unlocked ? (
          <PhotoUpload onClick={() => fileRef.current?.click()} disabled={busy}>
            {busy ? "Carico…" : "📷 Carica foto vincitori"}
          </PhotoUpload>
        ) : null}
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPick} />
      </PhotoZone>

      {isKnockout ? (
        <div>
          {rounds.map(([r, ms]) => (
            <Section key={r}>
              <SectionTitle style={{ fontSize: 16 }}>{ms[0]?.label || `Turno ${r}`}</SectionTitle>
              {ms.map((m) => <MatchCard key={m.id} m={m} coupleLabel={coupleLabel} colorOf={colorOf} unlocked={unlocked} onWinner={onWinner} />)}
            </Section>
          ))}
        </div>
      ) : (
        <>
          <Section>
            <SectionTitle style={{ fontSize: 16 }}>Classifica</SectionTitle>
            <ColHead>vinte / giocate</ColHead>
            {standings.map((s, i) => (
              <BoardRow key={s.id} $lead={i === 0 && s.w > 0}>
                <Rank>{i + 1}</Rank><Dot style={{ background: colorOf(s.id) }} />
                <BoardName>{coupleLabel(s.id)}</BoardName><BoardWins>{s.w}<Games>/{s.g}</Games></BoardWins>
              </BoardRow>
            ))}
          </Section>
          <Section>
            <SectionTitle style={{ fontSize: 16 }}>Calendario</SectionTitle>
            {rounds.map(([r, ms]) => {
              const playing = new Set<string>();
              ms.forEach((m) => { if (m.team_a) playing.add(m.team_a); if (m.team_b) playing.add(m.team_b); });
              const resting = teams.filter((tm) => !playing.has(tm.couple_id)).map((tm) => tm.couple_id);
              return (
                <div key={r} style={{ marginBottom: 14 }}>
                  <GiornataHead>
                    <span>Turno {r}</span>
                    {resting.length > 0 && <Rest>riposa: {resting.map(coupleLabel).join(", ")}</Rest>}
                  </GiornataHead>
                  {ms.map((m, idx) => (
                    <div key={m.id}>
                      {ms.length > 1 && <TableTag>Tavolo {idx + 1}</TableTag>}
                      <MatchCard m={m} coupleLabel={coupleLabel} colorOf={colorOf} unlocked={unlocked} onWinner={onWinner} />
                    </div>
                  ))}
                </div>
              );
            })}
          </Section>
        </>
      )}

      {/* Assegna campione a mano (spareggio / pareggio girone) */}
      {t.status === "ongoing" && unlocked && allDecided && (
        <Section>
          <SectionTitle style={{ fontSize: 16 }}>Assegna campione</SectionTitle>
          <Empty style={{ marginBottom: 10 }}>Tutte le partite sono giocate. Se serve uno spareggio, scegli il campione:</Empty>
          <Field>
            <Select value={manual} onChange={(e) => setManual(e.target.value)}>
              <option value="">— scegli la coppia campione —</option>
              {teams.map((tm) => <option key={tm.couple_id} value={tm.couple_id}>{coupleLabel(tm.couple_id)}</option>)}
            </Select>
          </Field>
          <CreateBtn disabled={!manual} onClick={() => manual && onFinish(t.id, manual)}>🏆 Assegna trofeo</CreateBtn>
        </Section>
      )}

      {unlocked && <DangerBtn onClick={() => onDelete(t.id)}>Elimina torneo</DangerBtn>}
    </>
  );
}

function MatchCard({ m, coupleLabel, colorOf, unlocked, onWinner }: {
  m: TournamentMatch; coupleLabel: (id: string) => string; colorOf: (id: string) => string;
  unlocked: boolean; onWinner: (mid: string, w: string) => void;
}) {
  const ready = m.team_a && m.team_b;
  if (!ready) return <PendingCard>In attesa dei vincitori del turno precedente…</PendingCard>;
  const decided = !!m.winner;
  return (
    <MCard>
      <MSide $win={m.winner === m.team_a} $dim={decided && m.winner !== m.team_a}
        onClick={() => !decided && unlocked && onWinner(m.id, m.team_a!)}>
        <Dot style={{ background: colorOf(m.team_a!) }} />{coupleLabel(m.team_a!)}
        {m.winner === m.team_a && <WinMark>🏆</WinMark>}
      </MSide>
      <MMid>{decided ? "batte" : "vs"}</MMid>
      <MSide $win={m.winner === m.team_b} $dim={decided && m.winner !== m.team_b}
        onClick={() => !decided && unlocked && onWinner(m.id, m.team_b!)}>
        <Dot style={{ background: colorOf(m.team_b!) }} />{coupleLabel(m.team_b!)}
        {m.winner === m.team_b && <WinMark>🏆</WinMark>}
      </MSide>
      {!decided && <MHint>{unlocked ? "tocca chi ha vinto" : "🔒 sblocca per segnare"}</MHint>}
    </MCard>
  );
}

// ===== helpers =====
// Comprime l'immagine sul dispositivo (max lato ~1000px, JPEG) per salvarla leggera.
async function fileToDataUrl(file: File, maxDim = 1000, quality = 0.72): Promise<string> {
  const bmp = await createImageBitmap(file);
  let w = bmp.width, h = bmp.height;
  const scale = Math.min(1, maxDim / Math.max(w, h));
  w = Math.round(w * scale); h = Math.round(h * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no ctx");
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  return canvas.toDataURL("image/jpeg", quality);
}

const fromISO = (s: string) => { const [y, m, d] = s.split("-"); return `${d} ${MESI[parseInt(m, 10) - 1]} ${y}`; };
const fmtLabel = (f: string) => f === "triangular" ? "Girone" : f === "knockout4" ? "Eliminazione (4)" : f === "knockout8" ? "Eliminazione (8)" : f;

// Testo condivisibile su WhatsApp, aggiornato ai risultati fino a ora
function buildExport(t: Tournament, teams: TournamentTeam[], matches: TournamentMatch[], coupleLabel: (id: string) => string): string {
  const isRR = t.format === "triangular";
  const L: string[] = [];
  L.push(`🏆 *${t.name}*`);
  if (t.event_date) L.push(fromISO(t.event_date));
  L.push(isRR ? "Girone all'italiana" : fmtLabel(t.format));
  L.push("");

  const byRound = new Map<number, TournamentMatch[]>();
  matches.forEach((m) => { const a = byRound.get(m.round) || []; a.push(m); byRound.set(m.round, a); });
  const rounds = Array.from(byRound.entries()).sort((a, b) => a[0] - b[0]);

  for (const [r, ms] of rounds) {
    ms.sort((x, y) => x.position - y.position);
    L.push(isRR ? `📅 *Turno ${r}*` : `*${ms[0]?.label || "Turno " + r}*`);
    ms.forEach((m, idx) => {
      const tav = isRR && ms.length > 1 ? `Tavolo ${idx + 1}: ` : "";
      if (!m.team_a || !m.team_b) { L.push(`${tav}(in attesa)`); return; }
      const a = coupleLabel(m.team_a), b = coupleLabel(m.team_b);
      if (m.winner) L.push(`${tav}${a} - ${b} → ✅ ${coupleLabel(m.winner)}`);
      else L.push(`${tav}${a} - ${b} → da giocare`);
    });
    if (isRR) {
      const playing = new Set<string>();
      ms.forEach((m) => { if (m.team_a) playing.add(m.team_a); if (m.team_b) playing.add(m.team_b); });
      const rest = teams.filter((tm) => !playing.has(tm.couple_id));
      if (rest.length) L.push(`   riposa: ${rest.map((x) => coupleLabel(x.couple_id)).join(", ")}`);
    }
    L.push("");
  }

  if (isRR) {
    const st = teams.map((tm) => ({
      id: tm.couple_id,
      w: matches.filter((m) => m.winner === tm.couple_id).length,
      g: matches.filter((m) => m.team_a === tm.couple_id || m.team_b === tm.couple_id).length,
    })).sort((a, b) => b.w - a.w || b.g - a.g);
    L.push("📊 *Classifica*");
    st.forEach((s, i) => L.push(`${i + 1}. ${coupleLabel(s.id)} — ${s.w} vinte / ${s.g} giocate`));
    L.push("");
  }

  if (t.status === "done" && t.winner_couple_id) L.push(`🏆 *CAMPIONE: ${coupleLabel(t.winner_couple_id)}*`);
  return L.join("\n").trim();
}

// ===== STILI =====
const GlobalStyle = createGlobalStyle` body { margin: 0; background: #0a120a; } `;
const Page = styled.div` min-height: 100dvh; background: radial-gradient(ellipse at 50% 0%, #12240f 0%, #0a120a 60%); color: #f5f0e8; font-family: 'Hanken Grotesk', 'Inter', -apple-system, sans-serif; padding-bottom: 60px; `;
const TopBar = styled.div` display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; background: rgba(6,10,6,0.85); backdrop-filter: blur(10px); border-bottom: 1px solid rgba(212,160,23,0.14); position: sticky; top: 0; z-index: 10; `;
const BackBtn = styled.button` background: rgba(19,33,19,0.9); border: 1px solid rgba(212,160,23,0.25); color: #d4a017; font-size: 13px; font-weight: 700; padding: 7px 12px; border-radius: 9px; cursor: pointer; `;
const LockBtn = styled.button` background: rgba(19,33,19,0.9); border: 1px solid rgba(212,160,23,0.25); font-size: 16px; padding: 6px 10px; border-radius: 9px; cursor: pointer; `;
const Title = styled.h1` font-family: var(--font-display), 'Times New Roman', serif; font-size: clamp(16px, 5vw, 22px); letter-spacing: 2px; color: #f0cf7a; margin: 0; `;
const Container = styled.div` max-width: 640px; margin: 0 auto; padding: 16px; `;
const ErrorBox = styled.div` background: rgba(230,57,70,0.15); border: 1px solid #e63946; color: #ff8b96; border-radius: 10px; padding: 10px 14px; font-size: 14px; margin-bottom: 12px; cursor: pointer; text-align: center; `;
const Loading = styled.div` text-align: center; color: #a09880; padding: 40px 0; `;
const CreateBtn = styled.button` width: 100%; background: #d4a017; color: #0a120a; border: none; padding: 14px; border-radius: 12px; font-weight: 800; font-size: 15px; cursor: pointer; &:disabled { opacity: 0.4; cursor: not-allowed; } `;
const DangerBtn = styled.button` width: 100%; margin-top: 16px; background: transparent; color: #e63946; border: 1px solid rgba(230,57,70,0.4); padding: 12px; border-radius: 12px; font-weight: 700; font-size: 14px; cursor: pointer; `;
const ShareBtn = styled.button` width: 100%; margin: 12px 0 4px; background: rgba(37,211,102,0.12); color: #4ee38a; border: 1.5px solid rgba(37,211,102,0.45); padding: 13px; border-radius: 12px; font-weight: 800; font-size: 14.5px; cursor: pointer; &:active { background: rgba(37,211,102,0.2); } `;
const Thumb = styled.img` width: 48px; height: 48px; border-radius: 10px; object-fit: cover; flex-shrink: 0; border: 1.5px solid rgba(212,160,23,0.4); cursor: zoom-in; `;
const PhotoZone = styled.div` margin: 8px 0 4px; `;
const PhotoImg = styled.img` width: 100%; max-height: 260px; object-fit: cover; border-radius: 14px; border: 1.5px solid rgba(212,160,23,0.35); cursor: zoom-in; display: block; `;
const PhotoActions = styled.div` display: flex; gap: 8px; margin-top: 8px; `;
const SmallGhost = styled.button<{ $danger?: boolean }>` flex: 1; padding: 9px; border-radius: 10px; font-size: 13px; font-weight: 700; cursor: pointer; background: transparent; border: 1.5px solid ${(p) => (p.$danger ? "rgba(230,57,70,0.4)" : "rgba(212,160,23,0.3)")}; color: ${(p) => (p.$danger ? "#e63946" : "#d4a017")}; &:disabled { opacity: 0.5; } `;
const PhotoUpload = styled.button` width: 100%; padding: 13px; border-radius: 12px; font-size: 14px; font-weight: 700; cursor: pointer; background: rgba(19,33,19,0.6); border: 1.5px dashed rgba(212,160,23,0.4); color: #d4a017; &:disabled { opacity: 0.6; } `;
const Lightbox = styled.div` position: fixed; inset: 0; background: rgba(0,0,0,0.92); display: flex; align-items: center; justify-content: center; z-index: 300; padding: 16px; cursor: zoom-out; img { max-width: 100%; max-height: 100%; border-radius: 10px; } `;
const LightClose = styled.div` position: fixed; top: 16px; right: 20px; color: #fff; font-size: 26px; font-weight: 700; `;
const List = styled.div` display: flex; flex-direction: column; gap: 10px; margin-top: 16px; `;
const TCard = styled.div` display: flex; align-items: center; gap: 12px; background: rgba(19,33,19,0.6); border: 1px solid rgba(212,160,23,0.14); border-radius: 14px; padding: 14px 16px; cursor: pointer; `;
const TName = styled.div` font-family: var(--font-display), serif; font-size: 17px; font-weight: 700; `;
const TMeta = styled.div` font-size: 12px; color: #a09880; margin-top: 2px; `;
const Champ = styled.div` font-size: 13px; font-weight: 700; color: #f0cf7a; text-align: right; flex-shrink: 0; max-width: 130px; `;
const Ongoing = styled.div` font-size: 11px; font-weight: 700; color: #35a566; background: rgba(53,165,102,0.14); padding: 4px 9px; border-radius: 8px; flex-shrink: 0; `;
const Section = styled.section` margin-top: 14px; background: rgba(19,33,19,0.55); border: 1px solid rgba(212,160,23,0.12); border-radius: 16px; padding: 16px; `;
const SectionTitle = styled.h2` font-family: var(--font-display), serif; font-size: 18px; letter-spacing: 0.5px; margin: 0 0 12px; `;
const Empty = styled.p` color: #77837b; font-size: 14px; margin: 0; b { color: #d4a017; } `;
const Field = styled.div` margin-bottom: 12px; `;
const Label = styled.label` display: block; font-size: 12px; color: #a09880; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; `;
const Input = styled.input` width: 100%; padding: 11px 12px; border-radius: 10px; border: 1.5px solid rgba(212,160,23,0.2); background: rgba(10,16,10,0.8); color: #f5f0e8; font-size: 15px; outline: none; &:focus { border-color: #d4a017; } &::placeholder { color: #5c6659; } `;
const Select = styled.select` width: 100%; padding: 11px 12px; border-radius: 10px; border: 1.5px solid rgba(212,160,23,0.2); background: rgba(10,16,10,0.8); color: #f5f0e8; font-size: 15px; outline: none; `;
const ChipGrid = styled.div` display: grid; grid-template-columns: 1fr 1fr; gap: 8px; @media (max-width: 400px) { grid-template-columns: 1fr; } `;
const TeamChip = styled.button<{ $on?: boolean; $color: string }>` position: relative; display: flex; align-items: center; gap: 8px; text-align: left; padding: 12px; border-radius: 12px; cursor: pointer; font-size: 13.5px; font-weight: 600; color: #f5f0e8; background: ${(p) => (p.$on ? `${p.$color}22` : "rgba(10,16,10,0.6)")}; border: 2px solid ${(p) => (p.$on ? p.$color : "rgba(212,160,23,0.12)")}; `;
const Seed = styled.span` position: absolute; top: -8px; left: -8px; width: 22px; height: 22px; border-radius: 50%; background: #d4a017; color: #0a120a; font-size: 12px; font-weight: 800; display: flex; align-items: center; justify-content: center; `;
const ModeTabs = styled.div` display: grid; grid-template-columns: 1fr 1fr; gap: 8px; `;
const ModeTab = styled.button<{ $on?: boolean }>` padding: 12px; border-radius: 11px; cursor: pointer; font-size: 13.5px; font-weight: 800; background: ${(p) => (p.$on ? "rgba(212,160,23,0.18)" : "rgba(10,16,10,0.6)")}; border: 2px solid ${(p) => (p.$on ? "#d4a017" : "rgba(212,160,23,0.12)")}; color: ${(p) => (p.$on ? "#f0cf7a" : "#a09880")}; `;
const DraftInfo = styled.div` margin-top: 10px; font-size: 13px; font-weight: 700; color: #d4a017; text-align: center; `;
const FormatList = styled.div` display: flex; flex-direction: column; gap: 8px; `;
const FormatOpt = styled.button<{ $on?: boolean }>` padding: 13px; border-radius: 10px; cursor: pointer; font-size: 14px; font-weight: 700; text-align: left; background: ${(p) => (p.$on ? "rgba(212,160,23,0.16)" : "rgba(10,16,10,0.6)")}; border: 2px solid ${(p) => (p.$on ? "#d4a017" : "rgba(212,160,23,0.12)")}; color: ${(p) => (p.$on ? "#f0cf7a" : "#a09880")}; `;
const DetailHead = styled.div` display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 8px; `;
const StatusPill = styled.span<{ $done?: boolean }>` font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 8px; flex-shrink: 0; background: rgba(212,160,23,0.15); color: #d4a017; `;
const ChampBanner = styled.div` display: flex; flex-direction: column; align-items: center; gap: 4px; background: linear-gradient(135deg, rgba(212,160,23,0.2), rgba(240,207,122,0.08)); border: 1.5px solid #d4a017; border-radius: 16px; padding: 18px; margin: 12px 0; span { font-size: 11px; letter-spacing: 2px; color: #d4a017; font-weight: 800; } b { font-family: var(--font-display), serif; font-size: 22px; color: #f0cf7a; text-align: center; } `;
const ColHead = styled.div` font-size: 9px; color: #5c6659; text-transform: uppercase; letter-spacing: 0.5px; text-align: right; margin: 0 0 6px; font-weight: 700; `;
const BoardRow = styled.div<{ $lead?: boolean }>` display: flex; align-items: center; gap: 9px; padding: 9px; border-radius: 9px; margin-bottom: 5px; background: ${(p) => (p.$lead ? "rgba(212,160,23,0.12)" : "rgba(10,16,10,0.5)")}; border: 1px solid ${(p) => (p.$lead ? "rgba(212,160,23,0.4)" : "transparent")}; `;
const Rank = styled.span` width: 16px; font-size: 13px; font-weight: 800; color: #77837b; `;
const BoardName = styled.span` flex: 1; font-size: 13.5px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; `;
const BoardWins = styled.span` font-size: 19px; font-weight: 800; color: #f0cf7a; `;
const Games = styled.span` font-size: 12px; color: #77837b; font-weight: 600; `;
const MCard = styled.div` background: rgba(10,16,10,0.5); border-radius: 12px; padding: 10px; margin-bottom: 8px; display: flex; flex-direction: column; gap: 8px; `;
const MSide = styled.button<{ $win?: boolean; $dim?: boolean }>` display: flex; align-items: center; gap: 8px; padding: 12px; border-radius: 10px; cursor: pointer; font-size: 14px; font-weight: ${(p) => (p.$win ? 800 : 600)}; color: ${(p) => (p.$dim ? "#77837b" : "#f5f0e8")}; background: ${(p) => (p.$win ? "rgba(212,160,23,0.16)" : "rgba(19,33,19,0.7)")}; border: 1.5px solid ${(p) => (p.$win ? "#d4a017" : "rgba(212,160,23,0.12)")}; `;
const WinMark = styled.span` margin-left: auto; `;
const MMid = styled.div` text-align: center; font-size: 11px; color: #77837b; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; `;
const MHint = styled.div` text-align: center; font-size: 11px; color: #5c6659; `;
const PendingCard = styled.div` background: rgba(10,16,10,0.4); border: 1px dashed rgba(212,160,23,0.15); border-radius: 12px; padding: 16px; text-align: center; color: #5c6659; font-size: 13px; margin-bottom: 8px; `;
const GiornataHead = styled.div` display: flex; align-items: baseline; justify-content: space-between; gap: 10px; margin: 6px 0 8px; span { font-family: var(--font-display), serif; font-size: 15px; color: #f0cf7a; font-weight: 700; } `;
const Rest = styled.span` font-size: 11px; color: #77837b; font-weight: 600; `;
const TableTag = styled.div` font-size: 10px; font-weight: 800; color: #d4a017; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 4px 2px; `;
const Dot = styled.span` width: 11px; height: 11px; border-radius: 50%; flex-shrink: 0; `;
const Toast = styled.div` position: fixed; left: 50%; bottom: 28px; transform: translateX(-50%); background: #14522f; color: #f5f0e8; border: 1px solid #35a566; padding: 12px 22px; border-radius: 12px; font-size: 15px; font-weight: 700; z-index: 200; box-shadow: 0 8px 30px rgba(0,0,0,0.6); `;
const ModalScrim = styled.div` position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 20px; `;
const Modal = styled.div` background: #16211a; border: 1px solid rgba(212,160,23,0.3); border-radius: 16px; padding: 24px; width: 100%; max-width: 320px; `;
const ModalTitle = styled.h2` font-family: var(--font-display), serif; font-size: 20px; margin: 0 0 6px; color: #f0cf7a; `;
const ModalSub = styled.p` font-size: 13px; color: #a09880; margin: 0 0 16px; `;
const PinInput = styled.input` width: 100%; text-align: center; letter-spacing: 8px; font-size: 24px; padding: 12px; border-radius: 10px; border: 1.5px solid rgba(212,160,23,0.3); background: rgba(10,16,10,0.8); color: #f5f0e8; outline: none; &:focus { border-color: #d4a017; } `;
const PinErr = styled.p` color: #ff8b96; font-size: 13px; margin: 8px 0 0; text-align: center; `;
const ModalActions = styled.div` display: flex; gap: 10px; margin-top: 18px; `;
const ModalCancel = styled.button` flex: 1; padding: 12px; border-radius: 10px; border: 1.5px solid rgba(212,160,23,0.2); background: transparent; color: #a09880; font-weight: 700; font-size: 14px; cursor: pointer; `;
const ModalOk = styled.button` flex: 2; padding: 12px; border-radius: 10px; border: none; background: #d4a017; color: #0a120a; font-weight: 800; font-size: 14px; cursor: pointer; &:disabled { opacity: 0.4; cursor: not-allowed; } `;
