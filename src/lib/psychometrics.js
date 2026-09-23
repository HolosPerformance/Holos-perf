// Outils psychométriques calculés côté navigateur : analyse factorielle
// exploratoire (AFE) et analyse réseau (EBICglasso), avec les avertissements
// de fiabilité associés. Les algorithmes suivent ceux de R (psych, GPArotation,
// glasso, qgraph) pour que les résultats soient comparables.

// ─── Algèbre linéaire ────────────────────────────────────────────────────────

const identity = (n) => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
const copyMatrix = (A) => A.map(row => row.slice());
const transpose = (A) => A[0].map((_, j) => A.map(row => row[j]));

function matMul(A, B) {
  const n = A.length, m = B[0].length, k = B.length;
  const C = Array.from({ length: n }, () => new Array(m).fill(0));
  for (let i = 0; i < n; i++) {
    for (let l = 0; l < k; l++) {
      const a = A[i][l];
      if (a === 0) continue;
      for (let j = 0; j < m; j++) C[i][j] += a * B[l][j];
    }
  }
  return C;
}

// Inversion par Gauss-Jordan avec pivot partiel ; null si la matrice est singulière
function invert(A) {
  const n = A.length;
  const M = A.map((row, i) => [...row, ...identity(n)[i]]);
  for (let c = 0; c < n; c++) {
    let pivot = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[pivot][c])) pivot = r;
    if (Math.abs(M[pivot][c]) < 1e-12) return null;
    [M[c], M[pivot]] = [M[pivot], M[c]];
    const d = M[c][c];
    for (let j = 0; j < 2 * n; j++) M[c][j] /= d;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c];
      if (f === 0) continue;
      for (let j = 0; j < 2 * n; j++) M[r][j] -= f * M[c][j];
    }
  }
  return M.map(row => row.slice(n));
}

// Valeurs et vecteurs propres d'une matrice symétrique (méthode de Jacobi),
// triés par valeur propre décroissante. vectors[i][k] = composante i du vecteur k.
function symmetricEigen(S) {
  const n = S.length;
  const A = copyMatrix(S);
  const V = identity(n);
  for (let sweep = 0; sweep < 100; sweep++) {
    let off = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += A[i][j] * A[i][j];
    if (off < 1e-22) break;
    for (let p = 0; p < n; p++) {
      for (let q = p + 1; q < n; q++) {
        if (Math.abs(A[p][q]) < 1e-15) continue;
        const theta = (A[q][q] - A[p][p]) / (2 * A[p][q]);
        const t = (theta >= 0 ? 1 : -1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        for (let k = 0; k < n; k++) {
          const akp = A[k][p], akq = A[k][q];
          A[k][p] = c * akp - s * akq;
          A[k][q] = s * akp + c * akq;
        }
        for (let k = 0; k < n; k++) {
          const apk = A[p][k], aqk = A[q][k];
          A[p][k] = c * apk - s * aqk;
          A[q][k] = s * apk + c * aqk;
        }
        for (let k = 0; k < n; k++) {
          const vkp = V[k][p], vkq = V[k][q];
          V[k][p] = c * vkp - s * vkq;
          V[k][q] = s * vkp + c * vkq;
        }
      }
    }
  }
  const order = A.map((row, i) => i).sort((a, b) => A[b][b] - A[a][a]);
  return {
    values: order.map(i => A[i][i]),
    vectors: V.map(row => order.map(i => row[i])),
  };
}

// ─── Fonctions statistiques ──────────────────────────────────────────────────

function logGamma(x) {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x;
  const tmp = x + 5.5 - (x + 0.5) * Math.log(x + 5.5);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) ser += c[j] / ++y;
  return -tmp + Math.log(2.5066282746310005 * ser / x);
}

// Fonction gamma incomplète régularisée P(a, x)
function gammaP(a, x) {
  if (x <= 0) return 0;
  if (x < a + 1) {
    let sum = 1 / a, del = sum, ap = a;
    for (let n = 0; n < 500; n++) {
      ap += 1; del *= x / ap; sum += del;
      if (Math.abs(del) < Math.abs(sum) * 1e-14) break;
    }
    return sum * Math.exp(-x + a * Math.log(x) - logGamma(a));
  }
  let b = x + 1 - a, c = 1 / 1e-300, d = 1 / b, h = d;
  for (let i = 1; i < 500; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300;
    c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-14) break;
  }
  return 1 - Math.exp(-x + a * Math.log(x) - logGamma(a)) * h;
}

const chiSquarePValue = (chi2, df) => 1 - gammaP(df / 2, chi2 / 2);

// Générateur pseudo-aléatoire déterministe (résultats reproductibles)
function seededNormal(seed) {
  let s = seed >>> 0;
  const uniform = () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return () => {
    const u = Math.max(uniform(), 1e-12);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * uniform());
  };
}

export function correlationMatrix(rows) {
  const n = rows.length, p = rows[0].length;
  const means = new Array(p).fill(0);
  rows.forEach(r => r.forEach((v, j) => { means[j] += v / n; }));
  const cov = Array.from({ length: p }, () => new Array(p).fill(0));
  rows.forEach(r => {
    for (let i = 0; i < p; i++) {
      const di = r[i] - means[i];
      for (let j = i; j < p; j++) cov[i][j] += di * (r[j] - means[j]);
    }
  });
  const sd = cov.map((row, i) => Math.sqrt(row[i]));
  const R = identity(p);
  for (let i = 0; i < p; i++) {
    for (let j = i + 1; j < p; j++) {
      const r = sd[i] > 0 && sd[j] > 0 ? cov[i][j] / (sd[i] * sd[j]) : 0;
      R[i][j] = R[j][i] = r;
    }
  }
  return R;
}

// ─── Préparation des données ─────────────────────────────────────────────────

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

// Construit la matrice saisies × indicateurs en ne gardant que les saisies
// complètes (tous les indicateurs renseignés). Les indicateurs sans variance
// sont retirés car ils empêchent tout calcul de corrélation.
export function prepareData(logs, keys, { centerByAthlete = false } = {}) {
  const withAny = logs.filter(log => keys.some(k => isNum(log[k])));
  const complete = withAny.filter(log => keys.every(k => isNum(log[k])));

  let rows = complete.map(log => keys.map(k => log[k]));
  if (centerByAthlete && rows.length > 0) {
    const byAthlete = {};
    complete.forEach((log, idx) => {
      (byAthlete[log.athlete_email] = byAthlete[log.athlete_email] || []).push(idx);
    });
    const centered = rows.map(r => r.slice());
    Object.values(byAthlete).forEach(indices => {
      keys.forEach((_, j) => {
        const mean = indices.reduce((s, i) => s + rows[i][j], 0) / indices.length;
        indices.forEach(i => { centered[i][j] = rows[i][j] - mean; });
      });
    });
    rows = centered;
  }

  const constantKeys = keys.filter((_, j) => {
    if (rows.length === 0) return false;
    const first = rows[0][j];
    return rows.every(r => Math.abs(r[j] - first) < 1e-12);
  });
  const keptIdx = keys.map((k, j) => j).filter(j => !constantKeys.includes(keys[j]));

  const athleteCounts = {};
  complete.forEach(log => { athleteCounts[log.athlete_email] = (athleteCounts[log.athlete_email] || 0) + 1; });

  return {
    keys: keptIdx.map(j => keys[j]),
    rows: rows.map(r => keptIdx.map(j => r[j])),
    n: complete.length,
    nWithAny: withAny.length,
    nAthletes: Object.keys(athleteCounts).length,
    singleEntryAthletes: Object.values(athleteCounts).filter(c => c === 1).length,
    constantKeys,
  };
}

// ─── Adéquation des données (KMO, Bartlett) ──────────────────────────────────

export function kmo(R) {
  const Rinv = invert(R);
  if (!Rinv) return null;
  const p = R.length;
  let sumR = 0, sumP = 0;
  const perItem = [];
  for (let i = 0; i < p; i++) {
    let ri = 0, pi = 0;
    for (let j = 0; j < p; j++) {
      if (i === j) continue;
      const partial = -Rinv[i][j] / Math.sqrt(Rinv[i][i] * Rinv[j][j]);
      ri += R[i][j] ** 2;
      pi += partial ** 2;
    }
    sumR += ri; sumP += pi;
    perItem.push(ri / (ri + pi));
  }
  return { overall: sumR / (sumR + sumP), perItem };
}

export function bartlett(R, n) {
  const p = R.length;
  const { values } = symmetricEigen(R);
  if (values.some(v => v <= 1e-12)) return null;
  const logDet = values.reduce((s, v) => s + Math.log(v), 0);
  const chi2 = -(n - 1 - (2 * p + 5) / 6) * logDet;
  const df = (p * (p - 1)) / 2;
  return { chi2, df, pValue: chiSquarePValue(chi2, df) };
}

// ─── Nombre de facteurs : analyse parallèle de Horn ──────────────────────────

export function parallelAnalysis(R, n, { iterations = 100, seed = 12345 } = {}) {
  const p = R.length;
  const observed = symmetricEigen(R).values;
  const normal = seededNormal(seed);
  const simulated = Array.from({ length: p }, () => []);
  for (let it = 0; it < iterations; it++) {
    const data = Array.from({ length: n }, () => Array.from({ length: p }, normal));
    symmetricEigen(correlationMatrix(data)).values.forEach((v, i) => simulated[i].push(v));
  }
  const threshold = simulated.map(vals => {
    const sorted = vals.slice().sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.floor(0.95 * sorted.length))];
  });
  let nFactors = 0;
  while (nFactors < p && observed[nFactors] > threshold[nFactors]) nFactors++;
  return { observed, threshold, nFactors: Math.max(1, nFactors) };
}

// ─── Extraction : factorisation en axes principaux ───────────────────────────

function principalAxis(R, k, { maxIter = 500, tol = 1e-6 } = {}) {
  const p = R.length;
  const Rinv = invert(R);
  let h2 = Rinv
    ? Rinv.map((row, i) => Math.min(0.995, Math.max(0.005, 1 - 1 / row[i])))
    : R.map((row, i) => Math.max(...row.filter((_, j) => j !== i).map(Math.abs)));
  let loadings = [];
  let converged = false;
  let iterations = 0;
  for (; iterations < maxIter; iterations++) {
    const Rr = copyMatrix(R);
    for (let i = 0; i < p; i++) Rr[i][i] = h2[i];
    const { values, vectors } = symmetricEigen(Rr);
    loadings = vectors.map(row => Array.from({ length: k }, (_, f) => row[f] * Math.sqrt(Math.max(values[f], 0))));
    const next = loadings.map(row => row.reduce((s, l) => s + l * l, 0));
    const diff = Math.max(...next.map((v, i) => Math.abs(v - h2[i])));
    h2 = next;
    if (diff < tol) { converged = true; break; }
  }
  return { loadings, communalities: h2, converged, iterations };
}

// ─── Rotations ───────────────────────────────────────────────────────────────

// Varimax avec normalisation de Kaiser (algorithme de stats::varimax)
function varimax(A, { maxIter = 1000, eps = 1e-5 } = {}) {
  const p = A.length, k = A[0].length;
  if (k < 2) return { loadings: A, phi: identity(k) };
  const sc = A.map(row => Math.sqrt(row.reduce((s, v) => s + v * v, 0)) || 1);
  const x = A.map((row, i) => row.map(v => v / sc[i]));
  let T = identity(k);
  let d = 0;
  for (let it = 0; it < maxIter; it++) {
    const z = matMul(x, T);
    const colSq = Array.from({ length: k }, (_, j) => z.reduce((s, row) => s + row[j] ** 2, 0) / p);
    const inner = z.map(row => row.map((v, j) => v ** 3 - v * colSq[j]));
    const B = matMul(transpose(x), inner);
    // Décomposition polaire B = U S V' → U V' = B (B'B)^(-1/2)
    const { values, vectors } = symmetricEigen(matMul(transpose(B), B));
    const invSqrt = matMul(
      vectors.map(row => row.map((v, j) => v / Math.sqrt(Math.max(values[j], 1e-15)))),
      transpose(vectors)
    );
    T = matMul(B, invSqrt);
    const dPast = d;
    d = values.reduce((s, v) => s + Math.sqrt(Math.max(v, 0)), 0);
    if (d < dPast * (1 + eps)) break;
  }
  const rotated = matMul(x, T).map((row, i) => row.map(v => v * sc[i]));
  return { loadings: rotated, phi: identity(k) };
}

// Critère oblimin (gamma = 0, « quartimin »)
function quartimin(L) {
  const L2 = L.map(row => row.map(v => v * v));
  let f = 0;
  const Gq = L.map((row, i) => row.map((v, j) => {
    const others = L2[i].reduce((s, w, m) => (m === j ? s : s + w), 0);
    f += L2[i][j] * others;
    return v * others;
  }));
  return { f: f / 4, Gq };
}

// Rotation oblique par gradient projeté (GPFoblq de GPArotation)
function oblimin(A, { maxIter = 1000, eps = 1e-5 } = {}) {
  const k = A[0].length;
  if (k < 2) return { loadings: A, phi: identity(k) };
  let T = identity(k);
  let L = matMul(A, transpose(invert(T)));
  let { f, Gq } = quartimin(L);
  let G = transpose(matMul(matMul(transpose(L), Gq), invert(T))).map(row => row.map(v => -v));
  let al = 1;
  for (let it = 0; it < maxIter; it++) {
    const colTG = Array.from({ length: k }, (_, j) => T.reduce((s, row, i) => s + row[j] * G[i][j], 0));
    const Gp = G.map((row, i) => row.map((v, j) => v - T[i][j] * colTG[j]));
    const s = Math.sqrt(Gp.reduce((acc, row) => acc + row.reduce((a, v) => a + v * v, 0), 0));
    if (s < eps) break;
    al *= 2;
    let Tt = T, Lt = L, next = { f, Gq };
    for (let i = 0; i <= 10; i++) {
      const X = T.map((row, r) => row.map((v, j) => v - al * Gp[r][j]));
      const norms = Array.from({ length: k }, (_, j) => Math.sqrt(X.reduce((acc, row) => acc + row[j] ** 2, 0)));
      Tt = X.map(row => row.map((v, j) => v / norms[j]));
      const TtInv = invert(Tt);
      if (!TtInv) { al /= 2; continue; }
      Lt = matMul(A, transpose(TtInv));
      next = quartimin(Lt);
      if (f - next.f > 0.5 * s * s * al) break;
      al /= 2;
    }
    T = Tt; L = Lt; f = next.f; Gq = next.Gq;
    G = transpose(matMul(matMul(transpose(L), Gq), invert(T))).map(row => row.map(v => -v));
  }
  return { loadings: L, phi: matMul(transpose(T), T) };
}

// ─── AFE complète ────────────────────────────────────────────────────────────

// Alpha de Cronbach standardisé, items de saturation négative inversés
function standardizedAlpha(R, items, signs) {
  if (items.length < 2) return null;
  let sum = 0, count = 0;
  items.forEach((i, a) => items.forEach((j, b) => {
    if (b > a) { sum += signs[a] * signs[b] * R[i][j]; count++; }
  }));
  const rBar = sum / count;
  return (items.length * rBar) / (1 + (items.length - 1) * rBar);
}

export function runEfa(R, n, { nFactors, rotation = 'oblimin', assignThreshold = 0.3 } = {}) {
  const p = R.length;
  const k = Math.max(1, Math.min(nFactors, p - 1));
  const extraction = principalAxis(R, k);
  const rotated = rotation === 'varimax' ? varimax(extraction.loadings) : oblimin(extraction.loadings);
  let loadings = rotated.loadings;
  let phi = rotated.phi;

  // Orientation : chaque facteur a une somme de saturations positive
  const signs = Array.from({ length: k }, (_, j) => (loadings.reduce((s, row) => s + row[j], 0) < 0 ? -1 : 1));
  loadings = loadings.map(row => row.map((v, j) => v * signs[j]));
  phi = phi.map((row, i) => row.map((v, j) => v * signs[i] * signs[j]));

  // Variance expliquée (comme psych : Phi pris en compte pour une rotation oblique)
  const LtL = matMul(transpose(loadings), loadings);
  const ssLoadings = rotation === 'varimax'
    ? LtL.map((row, j) => row[j])
    : matMul(phi, LtL).map((row, j) => row[j]);

  // Facteurs triés par variance expliquée décroissante
  const order = ssLoadings.map((_, j) => j).sort((a, b) => ssLoadings[b] - ssLoadings[a]);
  loadings = loadings.map(row => order.map(j => row[j]));
  phi = order.map(i => order.map(j => phi[i][j]));
  const ss = order.map(j => ssLoadings[j]);

  const communalities = extraction.communalities;

  // Chaque indicateur est rattaché au facteur où sa saturation est la plus forte
  const assignment = loadings.map(row => {
    let best = 0;
    row.forEach((v, j) => { if (Math.abs(v) > Math.abs(row[best])) best = j; });
    return Math.abs(row[best]) >= assignThreshold ? best : null;
  });
  const crossLoading = loadings.map(row => row.filter(v => Math.abs(v) >= assignThreshold).length > 1);

  const factors = Array.from({ length: k }, (_, j) => {
    const items = assignment.map((a, i) => (a === j ? i : null)).filter(i => i !== null);
    const itemSigns = items.map(i => (loadings[i][j] < 0 ? -1 : 1));
    return {
      index: j,
      ssLoadings: ss[j],
      proportion: ss[j] / p,
      items,
      alpha: standardizedAlpha(R, items, itemSigns),
    };
  });

  return {
    nFactors: k,
    rotation,
    loadings,
    phi,
    communalities,
    uniqueness: communalities.map(h => 1 - h),
    factors,
    assignment,
    crossLoading,
    totalVarianceExplained: communalities.reduce((s, h) => s + h, 0) / p,
    converged: extraction.converged,
    heywood: communalities.map((h, i) => (h >= 0.999 ? i : null)).filter(i => i !== null),
  };
}

// ─── Analyse réseau : glasso + sélection EBIC (comme qgraph::EBICglasso) ─────

const softThreshold = (x, l) => Math.sign(x) * Math.max(Math.abs(x) - l, 0);

function glasso(S, lambda, warm) {
  const p = S.length;
  const W = warm ? copyMatrix(warm.W) : copyMatrix(S);
  const B = warm ? copyMatrix(warm.B) : Array.from({ length: p }, () => new Array(p).fill(0));
  let meanAbs = 0;
  for (let i = 0; i < p; i++) for (let j = 0; j < p; j++) if (i !== j) meanAbs += Math.abs(S[i][j]);
  meanAbs /= p * (p - 1) || 1;
  const tol = 1e-4 * meanAbs;

  for (let outer = 0; outer < 200; outer++) {
    let change = 0;
    for (let j = 0; j < p; j++) {
      const beta = B[j];
      for (let inner = 0; inner < 1000; inner++) {
        let maxDelta = 0;
        for (let k = 0; k < p; k++) {
          if (k === j) continue;
          let r = S[k][j];
          for (let l = 0; l < p; l++) if (l !== j && l !== k) r -= W[k][l] * beta[l];
          const next = softThreshold(r, lambda) / W[k][k];
          maxDelta = Math.max(maxDelta, Math.abs(next - beta[k]));
          beta[k] = next;
        }
        if (maxDelta < 1e-7) break;
      }
      for (let k = 0; k < p; k++) {
        if (k === j) continue;
        let w = 0;
        for (let l = 0; l < p; l++) if (l !== j) w += W[k][l] * beta[l];
        change += Math.abs(w - W[k][j]);
        W[k][j] = W[j][k] = w;
      }
    }
    if (change / (p * (p - 1)) < tol) break;
  }

  const Theta = Array.from({ length: p }, () => new Array(p).fill(0));
  for (let j = 0; j < p; j++) {
    let dot = 0;
    for (let k = 0; k < p; k++) if (k !== j) dot += W[k][j] * B[j][k];
    const tjj = 1 / (W[j][j] - dot);
    Theta[j][j] = tjj;
    for (let k = 0; k < p; k++) if (k !== j) Theta[k][j] = -B[j][k] * tjj;
  }
  for (let i = 0; i < p; i++) for (let j = i + 1; j < p; j++) {
    const v = (Theta[i][j] + Theta[j][i]) / 2;
    Theta[i][j] = Theta[j][i] = v;
  }
  return { Theta, W, B };
}

export function ebicGlasso(R, n, { gamma = 0.5, nLambda = 100, lambdaMinRatio = 0.01 } = {}) {
  const p = R.length;
  let lambdaMax = 0;
  for (let i = 0; i < p; i++) for (let j = i + 1; j < p; j++) lambdaMax = Math.max(lambdaMax, Math.abs(R[i][j]));
  if (lambdaMax === 0) {
    return { weights: Array.from({ length: p }, () => new Array(p).fill(0)), lambda: 0, nEdges: 0 };
  }
  const lambdaMin = lambdaMax * lambdaMinRatio;
  const lambdas = Array.from({ length: nLambda }, (_, i) =>
    Math.exp(Math.log(lambdaMax) - (i * (Math.log(lambdaMax) - Math.log(lambdaMin))) / (nLambda - 1)));

  let warm = null;
  let best = null;
  lambdas.forEach(lambda => {
    const fit = glasso(R, lambda, warm);
    warm = fit;
    const eig = symmetricEigen(fit.Theta).values;
    if (eig.some(v => v <= 0)) return;
    const logDet = eig.reduce((s, v) => s + Math.log(v), 0);
    let trace = 0;
    for (let i = 0; i < p; i++) for (let j = 0; j < p; j++) trace += R[i][j] * fit.Theta[j][i];
    let nEdges = 0;
    for (let i = 0; i < p; i++) for (let j = i + 1; j < p; j++) if (Math.abs(fit.Theta[i][j]) > 1e-8) nEdges++;
    const logLik = (n / 2) * (logDet - trace);
    const ebic = -2 * logLik + nEdges * Math.log(n) + 4 * nEdges * gamma * Math.log(p);
    if (!best || ebic < best.ebic) best = { ebic, lambda, Theta: copyMatrix(fit.Theta), nEdges };
  });

  if (!best) return null;
  const T = best.Theta;
  const weights = T.map((row, i) => row.map((v, j) =>
    (i === j || Math.abs(v) <= 1e-8 ? 0 : -v / Math.sqrt(T[i][i] * T[j][j]))));
  return { weights, lambda: best.lambda, nEdges: best.nEdges };
}

// ─── Centralités ─────────────────────────────────────────────────────────────

export function centralities(weights) {
  const p = weights.length;
  const strength = weights.map(row => row.reduce((s, w) => s + Math.abs(w), 0));
  const expectedInfluence = weights.map(row => row.reduce((s, w) => s + w, 0));

  // Distances = 1 / |poids|, comme qgraph
  const dist = weights.map((row, i) => row.map((w, j) => (i === j ? 0 : (w !== 0 ? 1 / Math.abs(w) : Infinity))));

  // Plus courts chemins de chaque nœud (Dijkstra) + betweenness de Brandes
  const betweenness = new Array(p).fill(0);
  const allDist = [];
  for (let s = 0; s < p; s++) {
    const d = new Array(p).fill(Infinity);
    const sigma = new Array(p).fill(0);
    const preds = Array.from({ length: p }, () => []);
    const visited = new Array(p).fill(false);
    const stack = [];
    d[s] = 0; sigma[s] = 1;
    for (let iter = 0; iter < p; iter++) {
      let u = -1;
      for (let v = 0; v < p; v++) if (!visited[v] && d[v] < Infinity && (u === -1 || d[v] < d[u])) u = v;
      if (u === -1) break;
      visited[u] = true;
      stack.push(u);
      for (let v = 0; v < p; v++) {
        if (v === u || dist[u][v] === Infinity || visited[v]) continue;
        const alt = d[u] + dist[u][v];
        if (alt < d[v] - 1e-12) { d[v] = alt; sigma[v] = sigma[u]; preds[v] = [u]; }
        else if (Math.abs(alt - d[v]) <= 1e-12) { sigma[v] += sigma[u]; preds[v].push(u); }
      }
    }
    const delta = new Array(p).fill(0);
    while (stack.length) {
      const w = stack.pop();
      preds[w].forEach(v => { delta[v] += (sigma[v] / sigma[w]) * (1 + delta[w]); });
      if (w !== s) betweenness[w] += delta[w];
    }
    allDist.push(d);
  }
  // Graphe non orienté : chaque paire est comptée deux fois
  const betweennessHalf = betweenness.map(b => b / 2);

  const closeness = allDist.map(d => {
    const reachable = d.filter((v, j) => v !== Infinity && v > 0);
    const total = reachable.reduce((s, v) => s + v, 0);
    return total > 0 ? 1 / total : 0;
  });
  const disconnected = allDist.some(d => d.some(v => v === Infinity));

  return { strength, expectedInfluence, closeness, betweenness: betweennessHalf, disconnected };
}

export const globalStrength = (weights) => {
  let s = 0;
  for (let i = 0; i < weights.length; i++) for (let j = i + 1; j < weights.length; j++) s += Math.abs(weights[i][j]);
  return s;
};

// ─── Disposition du graphe (Fruchterman-Reingold pondéré) ────────────────────

export function forceLayout(weights, { iterations = 500, seed = 7 } = {}) {
  const p = weights.length;
  if (p === 0) return [];
  // Départ en cercle pour un résultat stable d'un calcul à l'autre
  let pos = Array.from({ length: p }, (_, i) => {
    const a = (2 * Math.PI * i) / p + seed * 0.01;
    return { x: Math.cos(a), y: Math.sin(a) };
  });
  const area = 4;
  const kConst = Math.sqrt(area / p);
  let temp = 0.2;
  for (let it = 0; it < iterations; it++) {
    const disp = pos.map(() => ({ x: 0, y: 0 }));
    for (let i = 0; i < p; i++) {
      for (let j = 0; j < p; j++) {
        if (i === j) continue;
        const dx = pos[i].x - pos[j].x, dy = pos[i].y - pos[j].y;
        const d = Math.max(Math.sqrt(dx * dx + dy * dy), 0.01);
        const rep = (kConst * kConst) / d;
        disp[i].x += (dx / d) * rep; disp[i].y += (dy / d) * rep;
        const w = Math.abs(weights[i][j]);
        if (w > 0) {
          const att = (d * d / kConst) * w;
          disp[i].x -= (dx / d) * att; disp[i].y -= (dy / d) * att;
        }
      }
      // Légère gravité vers le centre pour garder les nœuds isolés dans le cadre
      disp[i].x -= pos[i].x * 0.05; disp[i].y -= pos[i].y * 0.05;
    }
    pos = pos.map((pt, i) => {
      const len = Math.max(Math.sqrt(disp[i].x ** 2 + disp[i].y ** 2), 1e-9);
      const step = Math.min(len, temp);
      return { x: pt.x + (disp[i].x / len) * step, y: pt.y + (disp[i].y / len) * step };
    });
    temp = Math.max(0.005, temp * 0.99);
  }
  // Normalisation dans [0.08, 0.92]
  const xs = pos.map(pt => pt.x), ys = pos.map(pt => pt.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const spanX = maxX - minX || 1, spanY = maxY - minY || 1;
  return pos.map(pt => ({
    x: 0.08 + 0.84 * ((pt.x - minX) / spanX),
    y: 0.08 + 0.84 * ((pt.y - minY) / spanY),
  }));
}

// ─── Avertissements de fiabilité ─────────────────────────────────────────────
// level : 'block' (analyse impossible), 'warn' (résultat peu fiable), 'info'

const pct = (v) => `${Math.round(v * 100)} %`;
const frNum = (v, digits) => v.toFixed(digits).replace('.', ',');

function dataWarnings(data, labels, { centerByAthlete }) {
  const w = [];
  if (data.constantKeys.length > 0) {
    w.push({ level: 'warn', text: `Indicateur(s) sans variation retiré(s) de l'analyse : ${data.constantKeys.map(k => labels[k] || k).join(', ')}.` });
  }
  if (data.nWithAny > 0) {
    const excluded = 1 - data.n / data.nWithAny;
    if (excluded > 0.3) {
      w.push({ level: 'warn', text: `${pct(excluded)} des saisies sont exclues car incomplètes (${data.n} saisies complètes sur ${data.nWithAny}). Décocher les indicateurs peu renseignés peut augmenter l'échantillon.` });
    }
  }
  if (data.nAthletes === 1) {
    w.push({ level: 'info', text: 'Un seul athlète : l\'analyse décrit son fonctionnement propre (intra-individuel). Ses saisies successives ne sont pas indépendantes dans le temps.' });
  } else if (data.nAthletes > 1 && !centerByAthlete) {
    w.push({ level: 'warn', text: `Plusieurs saisies par athlète (${data.nAthletes} athlètes) : les réponses d'un même athlète ne sont pas indépendantes, et les différences entre athlètes se mélangent aux variations de chacun. L'option « Centrer par athlète » limite ce biais.` });
  } else if (data.nAthletes > 1 && centerByAthlete && data.singleEntryAthletes > 0) {
    w.push({ level: 'info', text: `${data.singleEntryAthletes} athlète(s) n'ont qu'une seule saisie complète : une fois centrées, leurs valeurs n'apportent aucune information.` });
  }
  if (data.nAthletes > 1 && data.nAthletes < 5 && !centerByAthlete) {
    w.push({ level: 'warn', text: `Seulement ${data.nAthletes} athlètes différents : les résultats reflètent surtout ces personnes et se généralisent mal.` });
  }
  return w;
}

const LIKERT_NOTE = { level: 'info', text: 'Les réponses sont sur des échelles ordinales (type Likert) ; les calculs utilisent des corrélations de Pearson, ce qui peut sous-estimer les liens quand les échelles ont peu de niveaux.' };

// Rassemble tout le calcul AFE et ses avertissements
export function analyzeEfa(logs, keys, labels, settings) {
  const warnings = [];
  if (keys.length < 3) {
    return { warnings: [{ level: 'block', text: 'Au moins 3 indicateurs sont nécessaires pour une AFE.' }] };
  }
  const data = prepareData(logs, keys, settings);
  warnings.push(...dataWarnings(data, labels, settings));
  const p = data.keys.length;
  if (p < 3) {
    return { data, warnings: [...warnings, { level: 'block', text: 'Moins de 3 indicateurs exploitables après exclusion des indicateurs sans variation.' }] };
  }
  if (data.n < p + 2 || data.n < 10) {
    return { data, warnings: [...warnings, { level: 'block', text: `Seulement ${data.n} saisies complètes pour ${p} indicateurs : impossible d'estimer une AFE (minimum ${Math.max(10, p + 2)}).` }] };
  }

  const R = correlationMatrix(data.rows);
  const kmoResult = kmo(R);
  const bartlettResult = bartlett(R, data.n);

  if (data.n < 100) warnings.push({ level: 'warn', text: `${data.n} saisies complètes : une AFE demande en général au moins 100 saisies (idéalement 200 ou plus).` });
  if (data.n / p < 5) warnings.push({ level: 'warn', text: `${frNum(data.n / p, 1)} saisies par indicateur : il en faut au moins 5, idéalement 10.` });
  const strong = [];
  for (let i = 0; i < p; i++) for (let j = i + 1; j < p; j++) if (Math.abs(R[i][j]) > 0.9) strong.push(`${labels[data.keys[i]]} / ${labels[data.keys[j]]}`);
  if (strong.length > 0) warnings.push({ level: 'warn', text: `Indicateurs quasi identiques (corrélation > 0,9) : ${strong.join(', ')}. Ils mesurent probablement la même chose ; en garder un seul stabilise l'analyse.` });
  if (!kmoResult || !bartlettResult) {
    warnings.push({ level: 'warn', text: 'La matrice de corrélations est singulière (indicateurs redondants ou trop peu de saisies) : KMO et Bartlett ne peuvent pas être calculés.' });
  }
  if (kmoResult) {
    if (kmoResult.overall < 0.6) warnings.push({ level: 'warn', text: `KMO global de ${frNum(kmoResult.overall, 2)} (< 0,60) : les indicateurs partagent trop peu de variance commune pour une AFE fiable.` });
    const weakItems = kmoResult.perItem.map((v, i) => (v < 0.5 ? labels[data.keys[i]] : null)).filter(Boolean);
    if (weakItems.length > 0) warnings.push({ level: 'warn', text: `KMO individuel < 0,50 pour : ${weakItems.join(', ')}. Ces indicateurs s'intègrent mal à la structure et peuvent être retirés.` });
  }
  if (bartlettResult && bartlettResult.pValue >= 0.05) {
    warnings.push({ level: 'warn', text: `Test de Bartlett non significatif (p = ${frNum(bartlettResult.pValue, 3)}) : les corrélations ne se distinguent pas du hasard.` });
  }

  const parallel = parallelAnalysis(R, data.n, { iterations: data.n * p > 20000 ? 50 : 100 });
  const requested = settings.nFactorsMode === 'manual' ? settings.nFactors : parallel.nFactors;
  const efa = runEfa(R, data.n, { nFactors: requested, rotation: settings.rotation, assignThreshold: settings.loadingThreshold });

  if (settings.nFactorsMode === 'manual' && requested !== efa.nFactors) {
    warnings.push({ level: 'info', text: `Nombre de facteurs ramené à ${efa.nFactors} (au plus ${p - 1} pour ${p} indicateurs).` });
  }
  if (!efa.converged) warnings.push({ level: 'warn', text: 'L\'extraction n\'a pas convergé : les saturations sont approximatives.' });
  if (efa.heywood.length > 0) warnings.push({ level: 'warn', text: `Cas de Heywood (communauté ≥ 1) pour : ${efa.heywood.map(i => labels[data.keys[i]]).join(', ')}. Signe de trop de facteurs ou d'un échantillon trop petit.` });
  const thinFactors = efa.factors.filter(f => f.items.length < 3).map(f => `F${f.index + 1}`);
  if (thinFactors.length > 0) warnings.push({ level: 'warn', text: `Facteur(s) avec moins de 3 indicateurs : ${thinFactors.join(', ')}. Un facteur solide en compte au moins 3.` });
  const unassigned = efa.assignment.map((a, i) => (a === null ? labels[data.keys[i]] : null)).filter(Boolean);
  if (unassigned.length > 0) warnings.push({ level: 'info', text: `Aucune saturation ≥ ${frNum(settings.loadingThreshold, 2)} pour : ${unassigned.join(', ')}.` });
  const cross = efa.crossLoading.map((c, i) => (c ? labels[data.keys[i]] : null)).filter(Boolean);
  if (cross.length > 0) warnings.push({ level: 'info', text: `Saturations croisées (sur plusieurs facteurs) pour : ${cross.join(', ')}.` });
  warnings.push(LIKERT_NOTE);

  return { data, R, kmo: kmoResult, bartlett: bartlettResult, parallel, efa, warnings };
}

// Rassemble tout le calcul réseau et ses avertissements
export function analyzeNetwork(logs, keys, labels, settings) {
  const warnings = [];
  if (keys.length < 3) {
    return { warnings: [{ level: 'block', text: 'Au moins 3 indicateurs sont nécessaires pour une analyse réseau.' }] };
  }
  const data = prepareData(logs, keys, settings);
  warnings.push(...dataWarnings(data, labels, settings));
  const p = data.keys.length;
  if (p < 3) {
    return { data, warnings: [...warnings, { level: 'block', text: 'Moins de 3 indicateurs exploitables après exclusion des indicateurs sans variation.' }] };
  }
  if (data.n < p + 2 || data.n < 10) {
    return { data, warnings: [...warnings, { level: 'block', text: `Seulement ${data.n} saisies complètes pour ${p} indicateurs : impossible d'estimer le réseau (minimum ${Math.max(10, p + 2)}).` }] };
  }

  const R = correlationMatrix(data.rows);
  const network = ebicGlasso(R, data.n, { gamma: settings.gamma });
  if (!network) {
    return { data, R, warnings: [...warnings, { level: 'block', text: 'Le réseau n\'a pas pu être estimé (matrice de corrélations dégénérée).' }] };
  }

  const nPossible = (p * (p - 1)) / 2;
  const recommended = Math.max(100, 3 * nPossible);
  if (data.n < recommended) {
    warnings.push({ level: 'warn', text: `${data.n} saisies complètes pour ${nPossible} liens possibles : au moins ${recommended} sont recommandées. Les liens et surtout les centralités peuvent être instables.` });
  }
  if (network.nEdges === 0) {
    warnings.push({ level: 'warn', text: 'Aucun lien conservé après régularisation : les données ne montrent pas de relation assez nette entre indicateurs (ou l\'échantillon est trop petit).' });
  }
  const cent = centralities(network.weights);
  if (cent.disconnected && network.nEdges > 0) {
    warnings.push({ level: 'info', text: 'Le réseau contient des indicateurs isolés : la proximité et l\'intermédiarité sont calculées seulement sur les parties connectées.' });
  }
  warnings.push({ level: 'info', text: 'Les centralités autres que la force (proximité, intermédiarité) sont souvent peu stables ; à interpréter avec prudence.' });
  warnings.push(LIKERT_NOTE);

  return { data, R, network, centralities: cent, globalStrength: globalStrength(network.weights), warnings };
}
