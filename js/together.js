/* ------------------------------------------------------------------
   together.js — Study with a friend, with no server anywhere.

   Three independent layers, each useful on its own:

   1. The synced timer.  The invite link carries the room id, the host's
      name, an absolute start time and a duration. Both browsers read the
      same wall clock, so both countdowns match to the second with nothing
      passing between them.
   2. Live partner stats.  BroadcastChannel when you're in the same
      browser; a peer-to-peer WebRTC data channel across devices, set up
      by swapping one link each way. No relay, no signalling server.
   3. The duel result.  A short result link you send back when you finish,
      so the head-to-head still closes even if no live channel exists.
-------------------------------------------------------------------*/
const Together = (function () {

  /* ------------------------------- codec ------------------------------- */
  const enc = obj => btoa(unescape(encodeURIComponent(JSON.stringify(obj))))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const dec = str => {
    const s = str.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(decodeURIComponent(escape(atob(s + '==='.slice((s.length + 3) % 4)))));
  };
  const base = () => location.origin + location.pathname;
  const rid = () => Math.random().toString(36).slice(2, 8);

  /* ---------------------------- invite links ---------------------------- */
  function makeRoom(opts) {
    return {
      id: rid(),
      host: (opts.name || 'Someone').slice(0, 24),
      startAt: Date.now() + Math.round((opts.startInMin || 1) * 60000),
      durationMin: Math.max(1, Math.min(240, Math.round(opts.durationMin || 25))),
      role: 'host'
    };
  }
  const inviteLink = r =>
    `${base()}#join=${enc({ r: r.id, h: r.host, s: r.startAt, d: r.durationMin })}`;

  const resultLink = (room, me, sum) =>
    `${base()}#result=${enc({ r: room.id, n: me, f: Math.round(sum.focusedMs), a: Math.round(sum.awayMs),
                              t: sum.tabSwitches, x: sum.distractions, s: sum.score })}`;

  /** Reads #join= / #result= / #live= out of the address bar. */
  function readHash() {
    const h = location.hash.replace(/^#/, '');
    const m = h.match(/^(join|result|live)=(.+)$/);
    if (!m) return null;
    try {
      const d = dec(m[2]);
      if (m[1] === 'join')   return { kind: 'join',   room: { id: d.r, host: d.h, startAt: d.s, durationMin: d.d, role: 'guest' } };
      if (m[1] === 'result') return { kind: 'result', result: { room: d.r, name: d.n, focusedMs: d.f, awayMs: d.a,
                                                                tabSwitches: d.t, distractions: d.x, score: d.s } };
      return { kind: 'live', payload: d };
    } catch (e) { console.warn('Unreadable link', e); return null; }
  }
  const clearHash = () => history.replaceState(null, '', base());

  /* ------------------------ WebRTC: compact SDP ------------------------ */
  /* A data-channel-only description is highly stereotyped, so only the
     handful of lines that actually differ need to travel in the link. */
  function squeeze(sdp) {
    const grab = re => (sdp.match(re) || ['', ''])[1];
    return {
      u: grab(/a=ice-ufrag:(\S+)/),
      p: grab(/a=ice-pwd:(\S+)/),
      f: grab(/a=fingerprint:sha-256 (\S+)/).replace(/:/g, ''),
      s: grab(/a=setup:(\S+)/),
      c: (sdp.match(/a=candidate:[^\r\n]+/g) || [])
           .map(l => l.replace('a=candidate:', '').trim())
           .filter(c => / udp /i.test(c))
           .map(c => {
             const t = c.split(' ');
             const head = t.slice(0, 8).join(' ');
             const ri = t.indexOf('raddr');
             return ri > -1 ? head + ' ' + t.slice(ri, ri + 4).join(' ') : head;
           })
           .slice(0, 8)
    };
  }

  function unsqueeze(o) {
    const fp = (o.f.match(/.{2}/g) || []).join(':');
    return [
      'v=0', 'o=- 1 1 IN IP4 127.0.0.1', 's=-', 't=0 0',
      'a=group:BUNDLE 0', 'a=msid-semantic: WMS',
      'm=application 9 UDP/DTLS/SCTP webrtc-datachannel',
      'c=IN IP4 0.0.0.0',
      'a=ice-ufrag:' + o.u, 'a=ice-pwd:' + o.p, 'a=ice-options:trickle',
      'a=fingerprint:sha-256 ' + fp, 'a=setup:' + o.s,
      'a=mid:0', 'a=sctp-port:5000', 'a=max-message-size:262144',
      ...o.c.map(c => 'a=candidate:' + c)
    ].join('\r\n') + '\r\n';
  }

  const gathered = pc => new Promise(res => {
    if (pc.iceGatheringState === 'complete') return res();
    const done = () => { pc.removeEventListener('icegatheringstatechange', check); res(); };
    const check = () => { if (pc.iceGatheringState === 'complete') done(); };
    pc.addEventListener('icegatheringstatechange', check);
    setTimeout(done, 3500);                 // don't wait forever on a slow STUN
  });

  const ICE = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

  /* ------------------------------ transport ------------------------------ */
  let room = null, me = '', bc = null, pc = null, dc = null;
  let handlers = {}, peer = null, mode = 'solo', lastRx = 0;
  /* Identity is per tab, not per name: two people can pick the same name,
     and one person can have the app open twice. */
  const selfId = Math.random().toString(36).slice(2, 10);

  const supported = { bc: 'BroadcastChannel' in window, rtc: 'RTCPeerConnection' in window };

  function emitStatus() { handlers.onStatus && handlers.onStatus(status()); }

  function status() {
    const fresh = peer && (Date.now() - lastRx < 9000);
    return { mode, peer: fresh ? peer : null, stale: !!peer && !fresh,
             live: mode === 'live', linked: mode !== 'solo' };
  }

  function receive(msg) {
    if (!msg || msg.from === selfId) return;          // our own echo
    lastRx = Date.now();
    if (msg.t === 'state') {
      peer = msg;
      if (mode === 'solo') { mode = bcLive ? 'linked' : mode; }
      handlers.onPeer && handlers.onPeer(msg);
    } else if (msg.t === 'nudge') {
      handlers.onNudge && handlers.onNudge(msg);
    } else if (msg.t === 'done') {
      handlers.onDone && handlers.onDone(msg);
    }
    emitStatus();
  }

  let bcLive = false;
  function join(r, name, hs) {
    leave();
    room = r; me = (name || 'You').slice(0, 24); handlers = hs || {};
    peer = null; mode = 'solo'; lastRx = 0; bcLive = false;
    if (supported.bc) {
      bc = new BroadcastChannel('studybuddy-room-' + room.id);
      bc.onmessage = e => { bcLive = true; if (mode === 'solo') mode = 'linked'; receive(e.data); };
    }
    emitStatus();
    return room;
  }

  function send(obj) {
    const msg = { ...obj, from: selfId, name: me, at: Date.now() };
    try { bc && bc.postMessage(msg); } catch (e) {}
    try { if (dc && dc.readyState === 'open') dc.send(JSON.stringify(msg)); } catch (e) {}
  }
  const publish = s => send({ t: 'state', ...s });
  const nudge = () => send({ t: 'nudge' });
  const finish = sum => send({ t: 'done', summary: sum });

  function leave() {
    try { bc && bc.close(); } catch (e) {}
    try { dc && dc.close(); } catch (e) {}
    try { pc && pc.close(); } catch (e) {}
    bc = dc = pc = null; room = null; peer = null; mode = 'solo'; bcLive = false;
  }

  /* --------------------- WebRTC handshake (two links) --------------------- */
  function wireChannel(channel) {
    dc = channel;
    dc.onopen = () => { mode = 'live'; lastRx = Date.now(); emitStatus(); handlers.onLive && handlers.onLive(); };
    dc.onclose = () => { mode = bcLive ? 'linked' : 'solo'; emitStatus(); };
    dc.onmessage = e => { try { receive(JSON.parse(e.data)); } catch (err) {} };
  }

  /** Host side: make the link that lets a friend see your stats live. */
  async function createLiveInvite() {
    if (!supported.rtc) throw new Error('This browser has no WebRTC.');
    if (!room) throw new Error('Start or join a room first.');
    try { pc && pc.close(); } catch (e) {}
    pc = new RTCPeerConnection(ICE);
    wireChannel(pc.createDataChannel('sb', { ordered: true }));
    pc.oniceconnectionstatechange = () => {
      if (/failed|disconnected/.test(pc.iceConnectionState) && mode === 'live') {
        mode = bcLive ? 'linked' : 'solo'; emitStatus();
      }
    };
    await pc.setLocalDescription(await pc.createOffer());
    await gathered(pc);
    return `${base()}#live=${enc({ r: room.id, k: 'o', n: me, d: squeeze(pc.localDescription.sdp) })}`;
  }

  /** Guest side: swallow their live link, hand back your reply link. */
  async function answerLiveInvite(payload) {
    if (!supported.rtc) throw new Error('This browser has no WebRTC.');
    try { pc && pc.close(); } catch (e) {}
    pc = new RTCPeerConnection(ICE);
    pc.ondatachannel = e => wireChannel(e.channel);
    await pc.setRemoteDescription({ type: 'offer', sdp: unsqueeze(payload.d) });
    await pc.setLocalDescription(await pc.createAnswer());
    await gathered(pc);
    return `${base()}#live=${enc({ r: payload.r, k: 'a', n: me, d: squeeze(pc.localDescription.sdp) })}`;
  }

  /** Host side again: take their reply link and the channel opens. */
  async function completeLive(payload) {
    if (!pc) throw new Error('Make a live link first — and keep this tab open.');
    await pc.setRemoteDescription({ type: 'answer', sdp: unsqueeze(payload.d) });
  }

  /** Accepts a pasted link or a raw #live= payload. */
  function readLiveLink(text) {
    const m = String(text || '').match(/#live=([A-Za-z0-9\-_]+)/);
    if (!m) throw new Error("That doesn't look like a live-sync link.");
    return dec(m[1]);
  }

  return {
    supported, makeRoom, inviteLink, resultLink, readHash, clearHash,
    join, leave, publish, nudge, finish, status,
    createLiveInvite, answerLiveInvite, completeLive, readLiveLink,
    get room() { return room; }, get me() { return me; }
  };
})();
