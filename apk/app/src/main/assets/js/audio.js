/* 极简 WebAudio 音效合成，无外部资源 */
window.AUDIO = (function () {
  var actx = null, ok = true, lastAt = {};

  function ensure() {
    if (actx) return actx;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { ok = false; return null; }
      actx = new AC();
    } catch (e) { ok = false; }
    return actx;
  }

  function resume() { var a = ensure(); if (a && a.state === 'suspended') a.resume(); }

  function tone(freq, dur, type, gain, slideTo) {
    if (!ok) return;
    var a = ensure(); if (!a) return;
    var t = a.currentTime;
    var o = a.createOscillator();
    var gnode = a.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t + dur);
    gnode.gain.setValueAtTime(0.0001, t);
    gnode.gain.exponentialRampToValueAtTime(gain || 0.08, t + 0.008);
    gnode.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(gnode); gnode.connect(a.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function noise(dur, gain, hp) {
    if (!ok) return;
    var a = ensure(); if (!a) return;
    var n = Math.floor(a.sampleRate * dur);
    var buf = a.createBuffer(1, n, a.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    var src = a.createBufferSource();
    src.buffer = buf;
    var bp = a.createBiquadFilter();
    bp.type = 'highpass'; bp.frequency.value = hp || 600;
    var gnode = a.createGain(); gnode.gain.value = gain || 0.06;
    src.connect(bp); bp.connect(gnode); gnode.connect(a.destination);
    src.start();
  }

  function throttled(key, ms) {
    var now = Date.now();
    if (lastAt[key] && now - lastAt[key] < ms) return false;
    lastAt[key] = now;
    return true;
  }

  return {
    resume: resume,
    hit: function () { if (throttled('hit', 70)) noise(0.07, 0.05, 1200); },
    cast: function () {
      if (!throttled('cast', 90)) return;
      tone(520, 0.18, 'triangle', 0.05, 900);
    },
    boom: function () {
      if (!throttled('boom', 200)) return;
      tone(120, 0.45, 'sawtooth', 0.09, 45);
      noise(0.3, 0.07, 200);
    },
    levelup: function () { tone(660, 0.12, 'sine', 0.05, 990); setTimeout(function () { tone(880, 0.16, 'sine', 0.05, 1320); }, 90); },
    kill: function () {
      if (!throttled('kill', 250)) return;
      tone(420, 0.1, 'square', 0.04, 300);
    },
    click: function () { tone(300, 0.05, 'sine', 0.03, 380); }
  };
})();
