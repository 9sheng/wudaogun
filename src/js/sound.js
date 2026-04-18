// Sound effects using Web Audio API (no external files needed)
const Sound = (() => {
  let ctx;
  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx;
  }

  function play(freq, type, duration, vol = 0.3) {
    try {
      const c = getCtx();
      const o = c.createOscillator();
      const g = c.createGain();
      o.connect(g); g.connect(c.destination);
      o.type = type;
      o.frequency.value = freq;
      g.gain.setValueAtTime(vol, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.01, c.currentTime + duration);
      o.start(); o.stop(c.currentTime + duration);
    } catch(e) {}
  }

  function place() { play(600, 'sine', 0.1, 0.2); }

  function pinch() {
    play(300, 'square', 0.15, 0.2);
    setTimeout(() => play(200, 'square', 0.2, 0.15), 100);
  }

  function formation() {
    play(523, 'sine', 0.15, 0.25);
    setTimeout(() => play(659, 'sine', 0.15, 0.25), 120);
    setTimeout(() => play(784, 'sine', 0.2, 0.25), 240);
  }

  function win() {
    [523, 659, 784, 1047].forEach((f, i) =>
      setTimeout(() => play(f, 'sine', 0.3, 0.3), i * 150));
  }

  function sacrifice() { play(180, 'sawtooth', 0.3, 0.15); }

  function tick() { play(1000, 'sine', 0.03, 0.1); }

  return { place, pinch, formation, win, sacrifice, tick };
})();
