// ===== VOICE MESH (WebRTC P2P, push-to-talk) =====
// Audio diretto tra i browser dei giocatori (2-4 = mesh leggera), senza
// server: la segnalazione viaggia sugli RPC di PlayroomKit. STUN pubblico
// di Google; TURN opzionale via variabili d'ambiente per le reti mobili
// difficili (NEXT_PUBLIC_TURN_URL / _USERNAME / _CREDENTIAL).

export interface VoiceSignal {
  to: string;
  from: string;
  kind: 'offer' | 'answer' | 'ice';
  data: any;
}

const buildIceServers = (): RTCIceServer[] => {
  const servers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];
  // Uno o più URL TURN separati da virgola (Metered/Cloudflare ne danno
  // diversi: porte 80/443, udp/tcp — più ce ne sono, più reti copriamo)
  const turnUrl = process.env.NEXT_PUBLIC_TURN_URL;
  if (turnUrl) {
    const username = process.env.NEXT_PUBLIC_TURN_USERNAME || '';
    const credential = process.env.NEXT_PUBLIC_TURN_CREDENTIAL || '';
    turnUrl
      .split(',')
      .map(u => u.trim())
      .filter(Boolean)
      .forEach(urls => servers.push({ urls, username, credential }));
  }
  return servers;
};

interface PeerEntry {
  pc: RTCPeerConnection;
  audio: HTMLAudioElement;
  makingOffer: boolean;
  polite: boolean;
  pendingIce: RTCIceCandidateInit[];
}

export class VoiceMesh {
  private myId: string;
  private send: (sig: VoiceSignal) => void;
  private peers = new Map<string, PeerEntry>();
  private localStream: MediaStream | null = null;
  private destroyed = false;

  constructor(myId: string, send: (sig: VoiceSignal) => void) {
    this.myId = myId;
    this.send = send;
  }

  hasMic(): boolean {
    return !!this.localStream;
  }

  /**
   * Chiede il permesso microfono (al primo push-to-talk: è un gesto utente,
   * il browser mostra il prompt). La traccia parte MUTA: trasmette solo
   * mentre il pulsante è premuto. Se ci sono già connessioni attive, la
   * traccia viene aggiunta e la rinegoziazione parte da sola.
   */
  async initMic(): Promise<boolean> {
    if (this.localStream) return true;
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      if (this.destroyed) {
        stream.getTracks().forEach(t => t.stop());
        return false;
      }
      stream.getAudioTracks().forEach(t => { t.enabled = false; });
      this.localStream = stream;
      this.peers.forEach(entry => {
        stream.getAudioTracks().forEach(track => entry.pc.addTrack(track, stream));
      });
      return true;
    } catch {
      return false;
    }
  }

  setTalking(on: boolean): void {
    this.localStream?.getAudioTracks().forEach(t => { t.enabled = on; });
  }

  /** Allinea la mesh ai giocatori presenti: crea i nuovi peer, chiude gli usciti. */
  syncPeers(remoteIds: string[]): void {
    if (this.destroyed) return;
    for (const [id, entry] of Array.from(this.peers)) {
      if (!remoteIds.includes(id)) this.closePeer(id, entry);
    }
    remoteIds.forEach(id => {
      if (id !== this.myId && !this.peers.has(id)) this.createPeer(id);
    });
  }

  private closePeer(id: string, entry: PeerEntry): void {
    try { entry.pc.close(); } catch {}
    entry.audio.srcObject = null;
    entry.audio.remove();
    this.peers.delete(id);
  }

  private createPeer(peerId: string): PeerEntry {
    const pc = new RTCPeerConnection({ iceServers: buildIceServers() });
    const audio = document.createElement('audio');
    audio.autoplay = true;
    (audio as any).playsInline = true;
    document.body.appendChild(audio);

    const entry: PeerEntry = {
      pc,
      audio,
      makingOffer: false,
      // "Perfect negotiation": in caso di offerte incrociate, il polite cede
      polite: this.myId > peerId,
      pendingIce: [],
    };
    this.peers.set(peerId, entry);

    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => pc.addTrack(track, this.localStream!));
    } else {
      // Solo ricezione finché non abbiamo il microfono: le connessioni si
      // stabiliscono subito e la voce altrui arriva senza chiedere permessi
      pc.addTransceiver('audio', { direction: 'recvonly' });
    }

    pc.ontrack = (e) => {
      audio.srcObject = e.streams[0] || new MediaStream([e.track]);
      audio.play().catch(() => {
        // Autoplay bloccato: riprova al primo tocco dell'utente
        const unlock = () => {
          audio.play().catch(() => {});
          document.removeEventListener('pointerdown', unlock);
        };
        document.addEventListener('pointerdown', unlock);
      });
    };

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        this.send({ to: peerId, from: this.myId, kind: 'ice', data: e.candidate.toJSON() });
      }
    };

    pc.onnegotiationneeded = async () => {
      try {
        entry.makingOffer = true;
        await pc.setLocalDescription();
        this.send({ to: peerId, from: this.myId, kind: 'offer', data: pc.localDescription });
      } catch {} finally {
        entry.makingOffer = false;
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        try { pc.restartIce(); } catch {}
      }
    };

    return entry;
  }

  async handleSignal(sig: VoiceSignal): Promise<void> {
    if (this.destroyed || sig.to !== this.myId || sig.from === this.myId) return;
    const entry = this.peers.get(sig.from) || this.createPeer(sig.from);
    const { pc } = entry;
    try {
      if (sig.kind === 'offer') {
        const collision = entry.makingOffer || pc.signalingState !== 'stable';
        if (collision && !entry.polite) return; // l'impolite ignora: vince la sua offerta
        await pc.setRemoteDescription(sig.data);
        await this.flushIce(entry);
        await pc.setLocalDescription();
        this.send({ to: sig.from, from: this.myId, kind: 'answer', data: pc.localDescription });
      } else if (sig.kind === 'answer') {
        await pc.setRemoteDescription(sig.data);
        await this.flushIce(entry);
      } else if (sig.kind === 'ice') {
        if (pc.remoteDescription) await pc.addIceCandidate(sig.data);
        else entry.pendingIce.push(sig.data);
      }
    } catch {
      // Segnale fuori sequenza durante una rinegoziazione: non fatale,
      // la prossima offerta riallinea la connessione
    }
  }

  private async flushIce(entry: PeerEntry): Promise<void> {
    for (const candidate of entry.pendingIce.splice(0)) {
      try { await entry.pc.addIceCandidate(candidate); } catch {}
    }
  }

  destroy(): void {
    this.destroyed = true;
    this.peers.forEach((entry, id) => this.closePeer(id, entry));
    this.localStream?.getTracks().forEach(t => t.stop());
    this.localStream = null;
  }
}
