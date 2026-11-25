// Regras do Jogo da Onça (Adugo). Módulo puro, sem DOM: usado pelo jogo, pela IA e pelo anfitrião online.
// Pontos 0..24 = quadrado 5x5 (id = y*5+x). Pontos 25..30 = triângulo.
export const N = 31, DOGS = 14, WIN_CAPTURES = 5, START_J = 12;

export const PTS = [];
for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) PTS.push({ x, y });
PTS.push({ x: 2, y: 5 }, { x: 2 - 4 / 3, y: 5 }, { x: 2 + 4 / 3, y: 5 },
         { x: 2 - 2 / 3, y: 6 }, { x: 2 + 2 / 3, y: 6 }, { x: 2, y: 7 });

const id = (x, y) => y * 5 + x;
export const EDGES = [];
for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) {
  if (x < 4) EDGES.push([id(x, y), id(x + 1, y)]);
  if (y < 4) EDGES.push([id(x, y), id(x, y + 1)]);
  if ((x + y) % 2 === 0) { // diagonais do quadrado
    if (x < 4 && y < 4) EDGES.push([id(x, y), id(x + 1, y + 1)]);
    if (x > 0 && y < 4) EDGES.push([id(x, y), id(x - 1, y + 1)]);
  }
}
// triângulo: 25 centro, 26/27 laterais baixas, 28/29 laterais altas, 30 ponta
EDGES.push([22, 25], [25, 30], [26, 25], [25, 27], [20, 26], [26, 28], [28, 30], [24, 27], [27, 29], [29, 30]);

export const ADJ = Array.from({ length: N }, () => []);
EDGES.forEach(([a, b]) => { ADJ[a].push(b); ADJ[b].push(a); });

// Saltos: a -> (sobre b) -> c, somente em linha reta pelas conexões existentes
export const JUMPS = Array.from({ length: N }, () => []);
for (let a = 0; a < N; a++) for (const b of ADJ[a]) {
  const dx = PTS[b].x - PTS[a].x, dy = PTS[b].y - PTS[a].y;
  for (const c of ADJ[b]) {
    if (c === a) continue;
    const ex = PTS[c].x - PTS[b].x, ey = PTS[c].y - PTS[b].y;
    if (Math.abs(dx * ey - dy * ex) < 1e-6 && dx * ex + dy * ey > 0) JUMPS[a].push({ over: b, to: c });
  }
}

// dogs[i]: posição (0..30), -1 = na mão (fora do tabuleiro), -2 = capturado
export function newState() {
  return { j: START_J, dogs: Array(DOGS).fill(-1), turn: 'd', captures: 0, chain: null, winner: null };
}
const clone = (s) => ({ ...s, dogs: s.dogs.slice() });
export const inHand = (s) => s.dogs.filter((p) => p === -1).length;

function occ(s) {
  const o = new Uint8Array(N);
  o[s.j] = 1;
  for (const p of s.dogs) if (p >= 0) o[p] = 2;
  return o;
}
function jagMoves(s, o, onlyJumps) {
  const out = [], a = s.j;
  if (!onlyJumps) for (const b of ADJ[a]) if (!o[b]) out.push({ t: 'step', from: a, to: b });
  for (const { over, to } of JUMPS[a]) if (o[over] === 2 && !o[to]) out.push({ t: 'jump', from: a, to, over });
  return out;
}
export const jaguarMoves = (s) => jagMoves(s, occ(s), false);

export function legalMoves(s) {
  if (s.winner) return [];
  const o = occ(s);
  if (s.turn === 'j') {
    if (s.chain !== null) { const m = jagMoves(s, o, true); m.push({ t: 'end' }); return m; }
    return jagMoves(s, o, false);
  }
  const out = [];
  if (s.dogs.includes(-1)) { for (let p = 0; p < N; p++) if (!o[p]) out.push({ t: 'place', to: p }); return out; }
  for (const from of s.dogs) if (from >= 0) for (const to of ADJ[from]) if (!o[to]) out.push({ t: 'move', from, to });
  return out;
}

export function applyUnchecked(s, m) {
  const n = clone(s);
  let captured = -1;
  if (m.t === 'place') { n.dogs[n.dogs.indexOf(-1)] = m.to; n.turn = 'j'; }
  else if (m.t === 'move') { n.dogs[n.dogs.indexOf(m.from)] = m.to; n.turn = 'j'; }
  else if (m.t === 'step') { n.j = m.to; n.turn = 'd'; n.chain = null; }
  else if (m.t === 'jump') {
    captured = n.dogs.indexOf(m.over);
    n.dogs[captured] = -2; n.captures++; n.j = m.to;
    if (n.captures >= WIN_CAPTURES) n.winner = 'j';
    else if (jagMoves(n, occ(n), true).length) n.chain = m.to;
    else { n.chain = null; n.turn = 'd'; }
  } else if (m.t === 'end') { n.chain = null; n.turn = 'd'; }

  if (!n.winner && n.turn === 'd') { // cachorros sem jogada: passam a vez
    const had = n.dogs.includes(-1) || n.dogs.some((p) => p >= 0 && ADJ[p].some((q) => !occ(n)[q]));
    if (!had) n.turn = 'j';
  }
  if (!n.winner && n.turn === 'j' && n.chain === null && !jagMoves(n, occ(n), false).length) n.winner = 'd';
  return { state: n, captured };
}

export function applyMove(s, m) {
  if (!m || typeof m !== 'object') return { ok: false };
  const l = legalMoves(s).find((x) => x.t === m.t && x.from === m.from && x.to === m.to);
  if (!l) return { ok: false };
  const r = applyUnchecked(s, l);
  return { ok: true, state: r.state, captured: r.captured, move: l };
}
