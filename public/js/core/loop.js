// Sabit adımlı oyun döngüsü: fizik her zaman Δt = 1/120 s ile ilerler,
// ekran yenilemesi ne olursa olsun sonuç aynıdır. timeScale ağır çekim/hızlı ileri.

import { DT } from '../config.js';

export function startLoop({ update, render, timeScale }) {
  let acc = 0;
  let last = performance.now();
  function frame(now) {
    const frameDt = Math.min((now - last) / 1000, 0.1);
    last = now;
    acc += frameDt * timeScale();
    let steps = 0;
    while (acc >= DT && steps < 120) {
      update(DT);
      acc -= DT;
      steps++;
    }
    if (steps === 120) acc = 0;
    render(frameDt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
