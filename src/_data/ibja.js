// Today's gold and silver rates from IBJA (India Bullion and Jewellers Association),
// read from https://ibjarates.com every time the site is built (GitHub rebuilds the
// site every few hours). IBJA publishes two rates a day: AM (around noon) and PM
// (evening). The newest one is shown, with the change from the previous day's PM rate.
// If IBJA can't be reached, the last good rates are kept in .cache/ and reused.
// Switch it off in the admin panel (सोना-चांदी भाव → अपने-आप भाव) to type rates by hand.
import fs from "node:fs";

const rates = JSON.parse(fs.readFileSync(new URL("./rates.json", import.meta.url), "utf8"));
const URL_IBJA = "https://ibjarates.com/";
const LAST_GOOD = ".cache/ibja-rates.json";
const TZ = "Asia/Kolkata";

const ROWS = [
  { key: "Gold999", chart: ["HdnGold", "purity999"], label: "सोना 24 कैरेट (999)", unit: "10 ग्राम" },
  { key: "Gold916", chart: ["HdnGold", "purity916"], label: "सोना 22 कैरेट (916)", unit: "10 ग्राम" },
  { key: "Silver999", chart: ["HdnSilver", "silverRate"], label: "चांदी (999)", unit: "1 किलो" },
];

const inr = new Intl.NumberFormat("en-IN");
const money = (n) => `₹ ${inr.format(n)}`;
const signed = (n) => (n > 0 ? `+${inr.format(n)}` : n < 0 ? `-${inr.format(-n)}` : "0");

// "23/10/2026" -> "2026-10-23"
const isoDay = (dmy) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dmy || "");
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
};
const todayIST = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());

function num(html, id) {
  const m = html.match(new RegExp(`id="${id}"[^>]*>([^<]*)<`));
  const n = m ? Number(m[1].replace(/[^\d]/g, "")) : NaN;
  return n > 0 ? n : 0;
}

// Price history behind IBJA's charts: {"labels":["dd/mm/yyyy",…],"purity999":[…],…} (PM rates)
function chart(html, id) {
  const m = html.match(new RegExp(`id="${id}" value="([^"]*)"`));
  if (!m) return null;
  try {
    return JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&"));
  } catch {
    return null;
  }
}

function parseIbja(html, today = todayIST()) {
  const rows = [];
  let date = "";
  let session = "";
  for (const row of ROWS) {
    const am = num(html, `lbl${row.key}_AM`);
    const pm = num(html, `lbl${row.key}_PM`);
    const price = pm || am;
    if (!price) throw new Error(`no ${row.key} rate on the page`);

    const c = chart(html, row.chart[0]) || {};
    const days = (c.labels || []).map(isoDay);
    const values = c[row.chart[1]] || [];
    let i = Math.min(days.length, values.length) - 1;
    // The chart already holds today's PM rate: the rate date is its last day.
    let day = pm && i >= 0 && Number(values[i]) === pm ? days[i] : today;
    while (i >= 0 && !(days[i] < day)) i--;
    const prev = i >= 0 ? Number(values[i]) : 0;

    rows.push({
      label: row.label,
      unit: row.unit,
      price: money(price),
      change: prev > 0 ? signed(price - prev) : "",
      value: price,
    });
    date ||= day;
    session ||= pm ? "PM" : "AM";
  }

  // Guard against a changed page: these must look like real per-10 g / per-kg rupee rates.
  const [g24, g22, silver] = rows.map((r) => r.value);
  const sane =
    g24 > 10000 && g24 < 1000000 && g22 < g24 && g22 > g24 * 0.85 && silver > 10000 && silver < 5000000;
  if (!sane) throw new Error(`rates look wrong: ${g24} / ${g22} / ${silver}`);

  return { date, session, rows, source: "IBJA", fetched: new Date().toISOString() };
}

async function load() {
  const res = await fetch(URL_IBJA, {
    headers: { "user-agent": "Mozilla/5.0 (compatible; IFC-knowledge-site/1.0; +https://ifcknowledge.github.io/)" },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parseIbja(await res.text());
}

function readLastGood() {
  try {
    return JSON.parse(fs.readFileSync(LAST_GOOD, "utf8"));
  } catch {
    return null;
  }
}

export default async function () {
  if (rates.auto === false) return null;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const data = await load();
      fs.mkdirSync(".cache", { recursive: true });
      fs.writeFileSync(LAST_GOOD, JSON.stringify(data));
      console.log(`[ibja] ${data.date} ${data.session}: ${data.rows.map((r) => r.price).join(" / ")}`);
      return data;
    } catch (err) {
      console.warn(`[ibja] attempt ${attempt} failed: ${err.message}`);
      if (attempt === 1) await new Promise((r) => setTimeout(r, 3000));
    }
  }

  const data = readLastGood();
  console.warn(data ? `[ibja] using rates of ${data.date} saved from an earlier build` : "[ibja] no rates available");
  return data;
}
