import { useCallback, useEffect, useRef, useState } from 'react';
import { RPC, PlayerState } from 'playroomkit';
import { VoiceMesh, VoiceSignal } from './voiceMesh';
import { vibrate } from './soundEffects';

export type MicStatus = 'idle' | 'starting' | 'ready' | 'denied' | 'unsupported';

/**
 * Push-to-talk P2P per il tavolo:
 * - le connessioni audio si stabiliscono subito in sola ricezione
 *   (senti gli altri senza dare permessi);
 * - alla prima pressione del pulsante viene chiesto il microfono
 *   (gesto utente → prompt del browser) e da lì si trasmette
 *   solo mentre il pulsante è premuto;
 * - lo stato "sta parlando" è condiviso via player state per
 *   l'anello verde sull'avatar.
 */
export const useVoiceChat = (players: PlayerState[], currentPlayerId: string) => {
  const [micStatus, setMicStatus] = useState<MicStatus>('idle');
  const [isTalking, setIsTalking] = useState(false);
  const meshRef = useRef<VoiceMesh | null>(null);

  const myPlayer = players.find(p => p.id === currentPlayerId) || null;
  const myPlayerRef = useRef(myPlayer);
  useEffect(() => { myPlayerRef.current = myPlayer; }, [myPlayer]);

  const voiceSupported =
    typeof window !== 'undefined' &&
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
    const mesh = meshRef.current;
    if (!mesh) return;
    if (!voiceSupported) {
      setMicStatus('unsupported');
      return;
    }
    if (!mesh.hasMic()) {
      setMicStatus('starting');
      const ok = await mesh.initMic();
      if (!ok) {
        setMicStatus('denied');
        return;
      }
      setMicStatus('ready');
    }
    mesh.setTalking(true);
    setIsTalking(true);
    vibrate(25);
    try { myPlayerRef.current?.setState('talking', true, true); } catch {}
  }, [voiceSupported]);

  const stopTalking = useCallback(() => {
    meshRef.current?.setTalking(false);
    setIsTalking(false);
    try { myPlayerRef.current?.setState('talking', false, true); } catch {}
  }, []);

  return { micStatus, isTalking, startTalking, stopTalking, voiceSupported };
};
