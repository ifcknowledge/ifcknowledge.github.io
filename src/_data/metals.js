// 22 carat gold and silver: today's rate, the rate 1 month, 1 year and 5 years ago, and a 5-year chart
// (the "सोना-चांदी: 5 साल" box on the home page). Built every time the site is built.
//
// Where the numbers come from:
//  • Today and the last ~4 months: IBJA's own daily rates (from ibja.js).
//  • Older dates: IBJA does not publish a free long history, so they are estimated from the
//    international price (COMEX gold and silver futures, Yahoo Finance) × the dollar-rupee rate,
//    scaled so that they match IBJA's rates over the months where both are known.
// The page says which values are estimates. If a source can't be reached, the last good data
// saved in .cache/ is used.
import fs from "node:fs";
import ibja from "./ibja.js";

const LAST_GOOD = ".cache/metals-intl.json";
const OZ = 31.1034768; // grams in a troy ounce
const TZ = "Asia/Kolkata";

const istDay = (ms) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(ms));

// Daily closes for the last 10 years (5 years are shown): [["2021-10-25", 1806.8], …]
async function yahoo(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=10y&interval=1d`;
  const res = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0 (compatible; IFC-knowledge-site/1.0; +https://ifcknowledge.github.io/)" },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`${symbol}: HTTP ${res.status}`);
  const r = (await res.json()).chart.result[0];
  const closes = r.indicators.quote[0].close;
  const out = r.timestamp.map((t, i) => [istDay(t * 1000), closes[i]]).filter(([, v]) => v > 0);
  if (out.length < 500) throw new Error(`${symbol}: only ${out.length} days`);
  return out;
}

async function international() {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const [gold, silver, inr] = await Promise.all([yahoo("GC=F"), yahoo("SI=F"), yahoo("INR=X")]);
      const data = { gold, silver, inr, fetched: new Date().toISOString() };
      fs.mkdirSync(".cache", { recursive: true });
      fs.writeFileSync(LAST_GOOD, JSON.stringify(data));
      return data;
    } catch (err) {
      console.warn(`[metals] international prices attempt ${attempt} failed: ${err.message}`);
      if (attempt === 1) await new Promise((r) => setTimeout(r, 3000));
    }
  }
  try {
    const data = JSON.parse(fs.readFileSync(LAST_GOOD, "utf8"));
    console.warn(`[metals] using international prices saved on ${data.fetched}`);
    return data;
  } catch {
    return null;
  }
}

// Rupee price per day: gold 22K per 10 g, silver per kg (before scaling to IBJA)
function inRupees(usd, inr, perUnit) {
  const rate = new Map(inr);
  const days = [...rate.keys()].sort();
  let j = 0;
  let last = 0;
  return usd
    .map(([d, v]) => {
      while (j < days.length && days[j] <= d) last = rate.get(days[j++]);
      return last ? [d, v * last * perUnit] : null;
    })
    .filter(Boolean);
}

const median = (arr) => {
  const s = [...arr].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0;
};

// Value on a day, or the closest earlier day
function on(series, day) {
  let found = null;
  for (const p of series) {
    if (p[0] <= day) found = p;
    else break;
  }
  return found;
}

const minus = (day, { months = 0, years = 0 }) => {
  const [y, m, d] = day.split("-").map(Number);
  const t = new Date(Date.UTC(y - years, m - 1 - months, 1));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  t.setUTCDate(Math.min(d, last));
  return t.toISOString().slice(0, 10);
};

// Chart geometry in percent of the chart box: the line is an SVG stretched to the box,
// the labels are normal text placed on top (so they stay readable on phones).
const W = 1000;
const H = 300;
function chart(series) {
  const pts = series.filter((p, i) => i % 3 === 0 || i === series.length - 1);
  const t0 = Date.parse(pts[0][0]);
  const t1 = Date.parse(pts[pts.length - 1][0]);
  const vals = pts.map((p) => p[1]);
  const lo = Math.min(...vals) * 0.92;
  const hi = Math.max(...vals) * 1.06;
  const x = (day) => ((Date.parse(day) - t0) / (t1 - t0 || 1)) * W;
  const y = (v) => (1 - (v - lo) / (hi - lo)) * H;
  const xy = pts.map(([d, v]) => `${x(d).toFixed(1)},${y(v).toFixed(1)}`);
  const line = `M${xy.join("L")}`;
  const area = `${line}L${W},${H}L0,${H}Z`;
  const pct = (v, total) => +((v / total) * 100).toFixed(2);
  const yTicks = [1, 2, 3].map((k) => {
    const v = lo + ((hi - lo) * k) / 4;
    return { y: +y(v).toFixed(1), pct: pct(y(v), H), label: short(v) };
  });
  const xTicks = [];
  for (let yr = Number(pts[0][0].slice(0, 4)) + 1; yr <= Number(pts.at(-1)[0].slice(0, 4)); yr++) {
    const px = x(`${yr}-01-01`);
    if (px > 30 && px < W - 30) xTicks.push({ x: +px.toFixed(1), pct: pct(px, W), label: String(yr) });
  }
  const end = pts.at(-1);
  return { W, H, line, area, yTicks, xTicks, end: { xp: pct(x(end[0]), W), yp: pct(y(end[1]), H) } };
}
function short(v) {
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(v >= 1e6 ? 0 : 1)} लाख`;
  return `₹${Math.round(v / 1000)} हज़ार`;
}

const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

function metal(key, intlRupees, ibjaHistory, todayValue, todayDay) {
  // Scale the international series to IBJA over the days where both are known
  const intlMap = new Map(intlRupees);
  const ratios = ibjaHistory.map(([d, v]) => (intlMap.has(d) ? v / intlMap.get(d) : 0)).filter((r) => r > 0.8 && r < 1.5);
  const scale = ratios.length >= 10 ? median(ratios) : null;
  if (!scale && !ibjaHistory.length) return null;

  const ibjaFrom = ibjaHistory.length ? ibjaHistory[0][0] : todayDay;
  const estimated = scale ? intlRupees.filter(([d]) => d < ibjaFrom).map(([d, v]) => [d, Math.round(v * scale), true]) : [];
  const series = [...estimated, ...ibjaHistory.map(([d, v]) => [d, v, false])];
  if (todayValue && (!series.length || series.at(-1)[0] < todayDay)) series.push([todayDay, todayValue, false]);
  if (series.length < 2) return null;

  const today = series.at(-1);
  const row = (label, day) => {
    const p = day ? on(series, day) : today;
    if (!p) return { label, missing: true };
    const change = p === today ? null : ((today[1] - p[1]) / p[1]) * 100;
    return {
      label,
      day: p[0],
      price: `₹ ${inr.format(p[1])}`,
      estimated: p[2],
      change: change === null ? "" : `${change >= 0 ? "+" : ""}${change.toFixed(change >= 100 || change <= -100 ? 0 : 1)}%`,
      up: change !== null && change >= 0,
    };
  };
  console.log(`[metals] ${key}: ${series.length} days from ${series[0][0]}, IBJA from ${ibjaFrom}, scale ${scale ? scale.toFixed(4) : "-"}`);
  return {
    today: row("आज", null),
    rows: [
      row("1 महीना पहले", minus(today[0], { months: 1 })),
      row("1 साल पहले", minus(today[0], { years: 1 })),
      row("5 साल पहले", minus(today[0], { years: 5 })),
    ],
    chart: chart(series.filter(([d]) => d >= minus(today[0], { years: 5, months: 1 }))),
    hasEstimates: estimated.length > 0,
  };
}

export default async function () {
  const [rates, intl] = await Promise.all([ibja(), international()]);
  const hist = rates?.history || { gold22: [], silver: [] };
  const value = (label) => rates?.rows?.find((r) => r.label.startsWith(label))?.value || 0;
  const today = rates?.date || (intl ? intl.gold.at(-1)[0] : "");

  const gold = intl ? inRupees(intl.gold, intl.inr, (10 / OZ) * 0.916) : [];
  const silver = intl ? inRupees(intl.silver, intl.inr, 1000 / OZ) : [];

  const result = {
    gold22: metal("gold22", gold, hist.gold22, value("सोना 22"), today),
    silver: metal("silver", silver, hist.silver, value("चांदी"), today),
  };
  return result.gold22 || result.silver ? result : null;
}
