/** A small dependency-free, pointer-accessible scratch card. */
export function mountScratchCard(container, {tableName, guestName = '', onReveal = () => {}} = {}) {
  if (!container || typeof tableName !== 'string' || !tableName.trim()) throw new TypeError('A container and table name are required.');
  const doc = container.ownerDocument;
  const win = doc.defaultView || globalThis;
  const wrapper = doc.createElement('div');
  wrapper.className = 'sc-wrap';
  wrapper.innerHTML = `<div class="sc-card" data-revealed="false"><div class="sc-under" aria-hidden="true"><p class="sc-kicker">YOUR TABLE · 你的座位</p><h3 class="sc-table" tabindex="-1"></h3><p class="sc-bottom">A place to celebrate together.</p></div><canvas class="sc-canvas" aria-hidden="true"></canvas><div class="sc-fallback-cover" hidden><em>A little surprise</em><span>点击下方按钮，揭晓你的桌号</span></div></div><p class="sc-instruction">用手指刮开卡片，或直接点击下方按钮。</p><button class="sc-reveal" type="button">直接显示桌号 <span>Tap to reveal</span></button><p class="sc-announcement" aria-live="polite" aria-atomic="true"></p>`;
  const card = wrapper.querySelector('.sc-card');
  const under = wrapper.querySelector('.sc-under');
  const table = wrapper.querySelector('.sc-table');
  const canvas = wrapper.querySelector('canvas');
  const fallback = wrapper.querySelector('.sc-fallback-cover');
  const revealButton = wrapper.querySelector('.sc-reveal');
  const instruction = wrapper.querySelector('.sc-instruction');
  const announcement = wrapper.querySelector('.sc-announcement');
  table.textContent = tableName;
  container.replaceChildren(wrapper);
  let ctx;
  try { ctx = canvas.getContext('2d'); } catch { ctx = null; }
  let revealed = false;
  let destroyed = false;
  let pointer = null;
  let previous = null;
  let width = 1;
  let height = 1;
  const columns = 40;
  const rows = 24;
  const cleared = new Set();

  function reveal({focus = false} = {}) {
    if (revealed || destroyed) return;
    revealed = true;
    pointer = null;
    card.dataset.revealed = 'true';
    under.removeAttribute('aria-hidden');
    revealButton.hidden = true;
    instruction.hidden = true;
    announcement.textContent = `${guestName ? `${guestName}，` : ''}你的桌号是 ${tableName}。Your table is ${tableName}.`;
    if (focus) table.focus({preventScroll:true});
    onReveal();
  }

  function drawCover() {
    if (destroyed || revealed) return;
    const rect = card.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    if (!ctx) { canvas.hidden = true; fallback.hidden = false; return; }
    const dpr = Math.min(3, win.devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#e3d6e9');
    gradient.addColorStop(.52, '#cbbbd7');
    gradient.addColorStop(1, '#e9dee8');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = '#f8f0e2bb';
    ctx.lineWidth = 1;
    ctx.strokeRect(12.5, 12.5, width - 25, height - 25);
    ctx.fillStyle = '#655177';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `italic ${width < 300 ? 25 : 29}px Georgia, serif`;
    ctx.fillText('A little surprise', width / 2, height / 2 - 25);
    ctx.font = '16px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText('刮开，找到你的座位', width / 2, height / 2 + 14);
    ctx.fillStyle = '#8b6e92';
    ctx.font = '13px Georgia, serif';
    ctx.fillText('SCRATCH TO REVEAL', width / 2, height / 2 + 45);
    // Small hand-drawn stars, kept decorative and away from the instruction.
    for (const [x, y, r] of [[width*.14, height*.24, 5], [width*.83, height*.76, 6], [width*.84, height*.19, 3]]) {
      ctx.beginPath();ctx.moveTo(x-r,y);ctx.lineTo(x+r,y);ctx.moveTo(x,y-r);ctx.lineTo(x,y+r);ctx.strokeStyle='#a78d61';ctx.stroke();
    }
    cleared.clear();
    previous = null;
  }

  function markCoverage(x, y, radius) {
    for (let row = 0; row < rows; row++) {
      const cy = (row + .5) / rows * height;
      if (Math.abs(cy-y) > radius) continue;
      for (let column = 0; column < columns; column++) {
        const cx = (column + .5) / columns * width;
        if ((cx-x)**2 + (cy-y)**2 <= radius**2) cleared.add(row * columns + column);
      }
    }
  }

  function scratch(event) {
    if (!ctx || revealed || destroyed) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = Math.max(0, Math.min(width, (event.clientX - rect.left) * width / rect.width));
    const y = Math.max(0, Math.min(height, (event.clientY - rect.top) * height / rect.height));
    const radius = Math.max(22, Math.min(31, width * .085));
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = radius * 2;
    ctx.beginPath();
    if (previous) {
      ctx.moveTo(previous.x, previous.y);ctx.lineTo(x, y);ctx.stroke();
      const steps = Math.ceil(Math.hypot(x-previous.x, y-previous.y) / (radius / 2));
      for (let i=1; i<=steps; i++) markCoverage(previous.x + (x-previous.x)*i/steps, previous.y + (y-previous.y)*i/steps, radius);
    }
    ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.fill();
    markCoverage(x,y,radius);
    previous = {x,y};
    if (cleared.size / (columns * rows) >= .42) reveal();
  }

  function pointerDown(event) {
    if (event.button !== 0 || revealed || destroyed || pointer !== null) return;
    pointer = event.pointerId;
    previous = null;
    canvas.setPointerCapture?.(pointer);
    scratch(event);
    event.preventDefault();
  }
  function pointerMove(event) { if (event.pointerId === pointer) { scratch(event); event.preventDefault(); } }
  function pointerEnd(event) { if (event.pointerId === pointer) { pointer = null; previous = null; } }
  function buttonReveal() { reveal({focus:true}); }
  canvas.addEventListener('pointerdown', pointerDown);
  canvas.addEventListener('pointermove', pointerMove);
  canvas.addEventListener('pointerup', pointerEnd);
  canvas.addEventListener('pointercancel', pointerEnd);
  canvas.addEventListener('lostpointercapture', pointerEnd);
  revealButton.addEventListener('click', buttonReveal);
  const observer = typeof win.ResizeObserver === 'function' ? new win.ResizeObserver(drawCover) : null;
  observer?.observe(card);
  if (!observer) win.addEventListener('resize', drawCover);
  drawCover();
  return {
    reveal,
    destroy() {
      destroyed = true;
      observer?.disconnect();
      win.removeEventListener('resize', drawCover);
      canvas.removeEventListener('pointerdown', pointerDown);
      canvas.removeEventListener('pointermove', pointerMove);
      canvas.removeEventListener('pointerup', pointerEnd);
      canvas.removeEventListener('pointercancel', pointerEnd);
      canvas.removeEventListener('lostpointercapture', pointerEnd);
      revealButton.removeEventListener('click', buttonReveal);
      wrapper.remove();
    }
  };
}
