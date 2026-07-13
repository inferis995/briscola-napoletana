import { useCallback, useEffect, useRef, useState } from 'react';
import { RPC, PlayerState } from 'playroomkit';
import { VoiceMesh, VoiceSignal } from './voiceMesh';
import { vibrate } from './soundEffects';

export type MicStatus = 'idle' | 'starting' | 'ready' | 'denied' | 'nomic' | 'error' | 'unsupported';

/**
 * Push-to-talk P2P per il tavolo:
 * - le connessioni audio si stabiliscono subito in sola ricezione
 *   (senti gli altri senza dare permessi);
 * - alla prima pressione del pulsante viene chiesto il microfono
 *   (gesto utente → prompt del browser) e da lì si trasmette
 *   solo mentre il pulsante è premuto;
 * - se il permesso è bloccato / manca il microfono, lo stato lo dice
 *   con precisione e si riprova a ogni pressione;
 * - lo stato "sta parlando" è condiviso via player state per
 *   l'anello verde sull'avatar.
 */
export const useVoiceChat = (players: PlayerState[], currentPlayerId: string) => {
  const [micStatus, setMicStatus] = useState<MicStatus>('idle');
  const [isTalking, setIsTalking] = useState(false);
  const meshRef = useRef<VoiceMesh | null>(null);
  // Vero solo mentre il pulsante è fisicamente premuto: evita che un rilascio
  // avvenuto DURANTE il prompt dei permessi lasci il microfono aperto
  const pressedRef = useRef(false);

  const myPlayer = players.find(p => p.id === currentPlayerId) || null;
  const myPlayerRef = useRef(myPlayer);
  useEffect(() => { myPlayerRef.current = myPlayer; }, [myPlayer]);

  const voiceSupported =
    typeof window !== 'undefined' &&
    window.isSecureContext !== false &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof RTCPeerConnection !== 'undefined';

  // Crea/distrugge la mesh e registra il canale di segnalazione
  useEffect(() => {
    if (!voiceSupported || !currentPlayerId) return;
    const mesh = new VoiceMesh(currentPlayerId, (sig: VoiceSignal) => {
      Promise.resolve(RPC.call('voiceSignal', sig, RPC.Mode.OTHERS)).catch(() => {});
    });
    meshRef.current = mesh;
    RPC.register('voiceSignal', async (sig: VoiceSignal) => {
      meshRef.current?.handleSignal(sig);
    });
    return () => {
      try { myPlayerRef.current?.setState('talking', false, true); } catch {}
      mesh.destroy();
      meshRef.current = null;
      setIsTalking(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPlayerId, voiceSupported]);

  // Stato permessi del browser: mostra subito "bloccato" se il sito è stato
  // negato in passato, e torna operativo da solo quando viene ri-consentito
  useEffect(() => {
    if (!voiceSupported) return;
    let permStatus: any = null;
    try {
      (navigator as any).permissions
        ?.query({ name: 'microphone' as PermissionName })
        .then((st: any) => {
          permStatus = st;
          if (st.state === 'denied') setMicStatus('denied');
          st.onchange = () => {
            if (st.state === 'denied') setMicStatus('denied');
            else setMicStatus(s => (s === 'denied' ? 'idle' : s));
          };
        })
        .catch(() => {});
    } catch {}
    return () => { if (permStatus) permStatus.onchange = null; };
  }, [voiceSupported]);

  // Mantiene la mesh allineata ai giocatori presenti
  const otherIds = players
    .filter(p => p.id !== currentPlayerId)
    .map(p => p.id)
    .sort()
    .join(',');
  useEffect(() => {
    meshRef.current?.syncPeers(otherIds ? otherIds.split(',') : []);
  }, [otherIds]);

  const startTalking = useCallback(async () => {
    pressedRef.current = true;
    const mesh = meshRef.current;
    if (!mesh) return;
    if (!voiceSupported) {
      setMicStatus('unsupported');
      return;
    }
    if (!mesh.hasMic()) {
      setMicStatus('starting');
      const result = await mesh.initMic();
      if (result !== 'ok') {
        setMicStatus(result);
        return;
      }
      setMicStatus('ready');
      // Pulsante rilasciato mentre il prompt era aperto: non trasmettere
      if (!pressedRef.current) return;
    }
    mesh.setTalking(true);
    setIsTalking(true);
    setMicStatus('ready');
    vibrate(25);
    try { myPlayerRef.current?.setState('talking', true, true); } catch {}
  }, [voiceSupported]);

  const stopTalking = useCallback(() => {
    pressedRef.current = false;
    meshRef.current?.setTalking(false);
    setIsTalking(false);
    try { myPlayerRef.current?.setState('talking', false, true); } catch {}
  }, []);

  return { micStatus, isTalking, startTalking, stopTalking, voiceSupported };
};
