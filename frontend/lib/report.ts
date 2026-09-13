/**
 * Monthly recycling report: aggregates dashboard stats into a standalone,
 * downloadable HTML document. Reuses the same data shapes, colors, and
 * label helpers as the Dashboard page (see lib/dashboard.ts).
 */
import { STATUSES, type Status } from "@/lib/collection-status";
import {
  monthLabel,
  monthTitleLabel,
  NEIGHBORHOOD_COLORS,
  PLASTIC_TYPE_COLORS,
  type DashboardStats,
  type WeekCollections,
} from "@/lib/dashboard";
import { strings } from "@/lib/strings";
import { COLORS } from "@/lib/theme";
import type { Pdr } from "@/lib/types";
import { mondayOfWeek, shortMondayDate } from "@/lib/week";

function prevMonth(year: number, month: number): { year: number; month: number } {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Weeks whose Monday falls within the given calendar month, sorted ascending. */
function weeksInMonth(weeks: WeekCollections[], year: number, month: number): WeekCollections[] {
  return weeks
    .filter((w) => {
      const mon = mondayOfWeek(w);
      return mon.getUTCFullYear() === year && mon.getUTCMonth() + 1 === month;
    })
    .sort((a, b) => a.year - b.year || a.week - b.week);
}

function stackedBarChart(opts: {
  weeks: WeekCollections[];
  segmentsFor: (w: WeekCollections) => { color: string; value: number }[];
  totalFor: (w: WeekCollections) => number;
  chartHeight: number;
}): string {
  const { weeks, segmentsFor, totalFor, chartHeight } = opts;
  const maxTotal = Math.max(1, ...weeks.map(totalFor));
  const bars = weeks
    .map((w) => {
      const segments = segmentsFor(w)
        .map((s) => {
          const h = s.value > 0 ? Math.max(2, Math.round((s.value / maxTotal) * chartHeight)) : 0;
          return h > 0 ? `<div style="height:${h}px;background:${s.color};"></div>` : "";
        })
        .join("");
      return `<div style="display:flex;flex-direction:column-reverse;width:56px;border-radius:4px 4px 0 0;overflow:hidden;">${segments}</div>`;
    })
    .join("");
  const footers = weeks
    .map(
      (w) =>
        `<div style="width:56px;text-align:center;font-size:10.5px;font-weight:700;color:${COLORS.mutedAlt};">${shortMondayDate(w)} · ${totalFor(w)}</div>`
    )
    .join("");
  return `
    <div style="display:flex;justify-content:center;align-items:flex-end;gap:36px;height:${chartHeight}px;padding:0 16px;">${bars}</div>
    <div style="display:flex;justify-content:center;gap:36px;padding:0 16px;margin-top:6px;">${footers}</div>`;
}

export interface MonthlyReportOptions {
  year: number;
  month: number;
  generatedOn: Date;
}

export function generateMonthlyReportHtml(
  stats: DashboardStats,
  pdrs: Pdr[],
  { year, month, generatedOn }: MonthlyReportOptions
): string {
  const s = strings.report;
  const monthTitle = monthTitleLabel(year, month);
  const prev = prevMonth(year, month);

  const weeks = weeksInMonth(stats.collections_by_week, year, month);

  const collectedThisMonth = weeks.reduce((sum, w) => sum + w.collected, 0);

  const newPdrs = pdrs.filter((p) => {
    const d = new Date(p.created_at);
    return d.getFullYear() === year && d.getMonth() + 1 === month;
  });

  const weightRowsThisMonth = stats.weight_by_month.filter((m) => m.year === year && m.month === month);
  const weightRowsPrevMonth = stats.weight_by_month.filter((m) => m.year === prev.year && m.month === prev.month);
  const weightThisMonth = weightRowsThisMonth.reduce((sum, m) => sum + m.weight_lbs, 0);
  const weightPrevMonth = weightRowsPrevMonth.reduce((sum, m) => sum + m.weight_lbs, 0);
  const hasPrevWeight = weightRowsPrevMonth.length > 0;
  const weightChangePct = hasPrevWeight && weightPrevMonth > 0
    ? Math.round(((weightThisMonth - weightPrevMonth) / weightPrevMonth) * 100)
    : null;

  const plasticTypes = Array.from(
    new Set([...weightRowsThisMonth, ...weightRowsPrevMonth].map((m) => m.plastic_type))
  );

  const neighborhoodRowsThisMonth = stats.collections_by_week_by_neighborhood.filter((n) => {
    const mon = mondayOfWeek(n);
    return mon.getUTCFullYear() === year && mon.getUTCMonth() + 1 === month;
  });
  const neighborhoods = Array.from(new Set(neighborhoodRowsThisMonth.map((n) => n.neighborhood))).sort((a, b) => {
    const totalA = neighborhoodRowsThisMonth.filter((n) => n.neighborhood === a).reduce((sum, n) => sum + n.collected, 0);
    const totalB = neighborhoodRowsThisMonth.filter((n) => n.neighborhood === b).reduce((sum, n) => sum + n.collected, 0);
    return totalB - totalA;
  });

  const statusTotals: Record<Status, number> = { collected: 0, empty: 0, unavailable: 0, closed: 0 };
  let statusGrandTotal = 0;
  for (const w of weeks) {
    statusTotals.collected += w.collected;
    statusTotals.empty += w.empty;
    statusTotals.unavailable += w.unavailable;
    statusTotals.closed += w.closed;
    statusGrandTotal += w.total;
  }

  const kpis = `
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px;">
    <div style="background:${COLORS.emeraldEnd};border-radius:16px;padding:14px 16px;color:#fff;">
      <div style="font-size:11px;font-weight:700;color:${COLORS.lime};">${s.weightCollected}</div>
      <div class="rp-font-display" style="font-size:26px;font-weight:800;margin-top:4px;">${weightThisMonth.toLocaleString("es-DO")} lbs</div>
      <div style="font-size:11px;font-weight:600;opacity:0.85;margin-top:2px;">${monthTitle}</div>
    </div>
    <div style="background:#fff;border:1px solid ${COLORS.hairline};border-radius:16px;padding:14px 16px;">
      <div style="font-size:11px;font-weight:700;color:${COLORS.mutedAlt};">${s.changeVsPrevMonth}</div>
      <div class="rp-font-display" style="font-size:26px;font-weight:800;margin-top:4px;color:${weightChangePct === null ? COLORS.muted : weightChangePct >= 0 ? COLORS.status.collected.text : COLORS.status.unavailable.text};">${weightChangePct === null ? "—" : `${weightChangePct >= 0 ? "+" : ""}${weightChangePct}%`}</div>
      <div style="font-size:11px;font-weight:600;color:${COLORS.muted};margin-top:2px;">${hasPrevWeight ? `${weightPrevMonth.toLocaleString("es-DO")} lbs ${monthLabel(prev.year, prev.month)}` : s.noPreviousData}</div>
    </div>
    <div style="background:#fff;border:1px solid ${COLORS.hairline};border-radius:16px;padding:14px 16px;">
      <div style="font-size:11px;font-weight:700;color:${COLORS.mutedAlt};">${s.newPdrsAdded}</div>
      <div class="rp-font-display" style="font-size:26px;font-weight:800;margin-top:4px;color:${COLORS.ink};">${newPdrs.length}</div>
      <div style="font-size:11px;font-weight:600;color:${COLORS.muted};margin-top:2px;">${stats.total_pdrs} en total</div>
    </div>
    <div style="background:#fff;border:1px solid ${COLORS.hairline};border-radius:16px;padding:14px 16px;">
      <div style="font-size:11px;font-weight:700;color:${COLORS.mutedAlt};">${s.collectionsRegistered}</div>
      <div class="rp-font-display" style="font-size:26px;font-weight:800;margin-top:4px;color:${COLORS.ink};">${collectedThisMonth}</div>
      <div style="font-size:11px;font-weight:600;color:${COLORS.muted};margin-top:2px;">${s.pointsMarkedCollected}</div>
    </div>
  </div>`;

  const neighborhoodLegend = neighborhoods
    .map(
      (n, i) =>
        `<span><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${NEIGHBORHOOD_COLORS[i % NEIGHBORHOOD_COLORS.length]};margin-right:4px;"></span>${esc(n)}</span>`
    )
    .join("");

  const weeklyByNeighborhoodChart = weeks.length
    ? stackedBarChart({
        weeks,
        segmentsFor: (w) =>
          neighborhoods.map((n, i) => ({
            color: NEIGHBORHOOD_COLORS[i % NEIGHBORHOOD_COLORS.length],
            value: neighborhoodRowsThisMonth.find((r) => r.neighborhood === n && r.year === w.year && r.week === w.week)?.collected ?? 0,
          })),
        totalFor: (w) => neighborhoodRowsThisMonth.filter((r) => r.year === w.year && r.week === w.week).reduce((sum, r) => sum + r.collected, 0),
        chartHeight: 82,
      })
    : `<div style="padding:16px 0;color:${COLORS.muted};font-size:12.5px;">${s.noWeeksInMonth}</div>`;

  const statusLegend = STATUSES.map(
    (status) =>
      `<span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${COLORS.status[status].dot};margin-right:4px;"></span>${esc(strings.collectionPass.statuses[status])}</span>`
  ).join("");

  const weeklyByStatusChart = weeks.length
    ? stackedBarChart({
        weeks,
        segmentsFor: (w) => STATUSES.map((status) => ({ color: COLORS.status[status].dot, value: w[status] })),
        totalFor: (w) => w.total,
        chartHeight: 64,
      })
    : `<div style="padding:16px 0;color:${COLORS.muted};font-size:12.5px;">${s.noWeeksInMonth}</div>`;

  const maxWeight = Math.max(1, ...plasticTypes.map((t) => {
    const cur = weightRowsThisMonth.find((m) => m.plastic_type === t)?.weight_lbs ?? 0;
    const prv = weightRowsPrevMonth.find((m) => m.plastic_type === t)?.weight_lbs ?? 0;
    return Math.max(cur, prv);
  }));

  const weightByTypeChart = plasticTypes.length
    ? `
    <div style="display:flex;justify-content:center;gap:12px;font-size:10.5px;font-weight:700;color:${COLORS.mutedAlt};margin-bottom:8px;">
      <span><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${COLORS.ink};opacity:0.35;margin-right:4px;"></span>${monthLabel(prev.year, prev.month)}</span>
      <span><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${COLORS.ink};opacity:1;margin-right:4px;"></span>${monthTitle}</span>
    </div>
    <div style="display:flex;justify-content:center;align-items:flex-end;gap:22px;height:96px;padding:0 4px;">
      ${plasticTypes
        .map((t) => {
          const cur = weightRowsThisMonth.find((m) => m.plastic_type === t)?.weight_lbs ?? 0;
          const prv = weightRowsPrevMonth.find((m) => m.plastic_type === t)?.weight_lbs ?? 0;
          const color = PLASTIC_TYPE_COLORS[t] ?? "#999";
          const curH = Math.max(cur > 0 ? 2 : 0, Math.round((cur / maxWeight) * 96));
          const prvH = Math.max(prv > 0 ? 2 : 0, Math.round((prv / maxWeight) * 96));
          return `<div style="display:flex;align-items:flex-end;gap:5px;height:100%;">
            <div style="width:20px;height:${prvH}px;background:${color};opacity:0.35;border-radius:4px 4px 0 0;"></div>
            <div style="width:20px;height:${curH}px;background:${color};border-radius:4px 4px 0 0;"></div>
          </div>`;
        })
        .join("")}
    </div>
    <div style="display:flex;justify-content:center;gap:22px;padding:0 4px;margin-top:6px;">
      ${plasticTypes
        .map((t) => {
          const cur = Math.round(weightRowsThisMonth.find((m) => m.plastic_type === t)?.weight_lbs ?? 0);
          const prv = Math.round(weightRowsPrevMonth.find((m) => m.plastic_type === t)?.weight_lbs ?? 0);
          const label = strings.weights.plasticTypes[t as keyof typeof strings.weights.plasticTypes] ?? t;
          return `<div style="width:45px;font-size:11px;font-weight:700;color:${COLORS.ink};text-align:center;">${esc(label)}<div style="font-size:10px;font-weight:600;color:${COLORS.muted};">${prv}/${cur}</div></div>`;
        })
        .join("")}
    </div>`
    : `<div style="padding:16px 0;color:${COLORS.muted};font-size:12.5px;">${s.noWeightInMonth}</div>`;

  const statusDistribution = statusGrandTotal > 0
    ? (() => {
        let offset = 0;
        const stops = STATUSES.map((status) => {
          const pct = (statusTotals[status] / statusGrandTotal) * 100;
          const stop = `${COLORS.status[status].dot} ${offset}% ${offset + pct}%`;
          offset += pct;
          return stop;
        }).join(", ");
        const rows = STATUSES.map((status) => {
          const pct = Math.round((statusTotals[status] / statusGrandTotal) * 100);
          return `<div style="display:flex;justify-content:space-between;align-items:center;font-size:11.5px;font-weight:600;color:${COLORS.body};padding:3px 0;">
            <span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${COLORS.status[status].dot};margin-right:6px;"></span>${esc(strings.collectionPass.statuses[status])}</span>
            <span style="font-weight:800;color:${COLORS.ink};">${pct}%</span>
          </div>`;
        }).join("");
        return `<div style="display:flex;align-items:center;gap:18px;">
          <div style="width:96px;height:96px;border-radius:50%;background:conic-gradient(${stops});flex-shrink:0;"></div>
          <div style="flex:1;">${rows}</div>
        </div>`;
      })()
    : `<div style="padding:16px 0;color:${COLORS.muted};font-size:12.5px;">${s.noWeeksInMonth}</div>`;

  const dateStr = generatedOn.toLocaleDateString("es-DO", { day: "numeric", month: "long", year: "numeric" });

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(s.title)} — ${esc(monthTitle)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@700;800&family=Hanken+Grotesk:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; }
  body { margin: 0; background: ${COLORS.canvas}; font-family: 'Hanken Grotesk', -apple-system, sans-serif; color: ${COLORS.body}; }
  .rp-font-display { font-family: 'Bricolage Grotesque', sans-serif; letter-spacing: -0.02em; }
  .page { max-width: 900px; margin: 0 auto; padding: 28px 40px 40px; }
  .card { background: #fff; border: 1px solid ${COLORS.hairline}; border-radius: 18px; padding: 14px 20px; margin-bottom: 12px; }
  .card-title { font-size: 14px; font-weight: 700; color: ${COLORS.ink}; }
  @media print {
    body { background: #fff; }
    .page { max-width: none; padding: 12px 20px; }
  }
</style>
</head>
<body>
<div class="page">

  <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid ${COLORS.hairline};padding-bottom:10px;margin-bottom:14px;">
    <div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
        <div style="width:10px;height:10px;border-radius:50%;background:${COLORS.emeraldEnd};"></div>
        <span class="rp-font-display" style="font-size:13px;font-weight:800;color:${COLORS.emeraldEnd};text-transform:uppercase;letter-spacing:0.06em;">${esc(s.brand)}</span>
      </div>
      <h1 class="rp-font-display" style="font-size:26px;font-weight:800;color:${COLORS.ink};margin:0;">${esc(s.title)}</h1>
      <div style="font-size:13px;font-weight:600;color:${COLORS.mutedAlt};margin-top:4px;">${esc(monthTitle)}</div>
    </div>
    <div style="text-align:right;font-size:11px;color:${COLORS.muted};font-weight:600;">
      Generado el ${esc(dateStr)}<br>${esc(s.internalUse)}
    </div>
  </div>

  ${kpis}

  <div class="card">
    <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px;">
      <div class="rp-font-display card-title">${esc(s.weeklyByNeighborhoodTitle)}</div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;font-size:10px;font-weight:700;color:${COLORS.mutedAlt};">${neighborhoodLegend}</div>
    </div>
    ${weeklyByNeighborhoodChart}
  </div>

  <div class="card">
    <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px;">
      <div class="rp-font-display card-title">${esc(s.weeklyByStatusTitle)}</div>
      <div style="display:flex;gap:14px;font-size:10.5px;font-weight:700;color:${COLORS.mutedAlt};">${statusLegend}</div>
    </div>
    ${weeklyByStatusChart}
  </div>

  <div style="display:grid;grid-template-columns:1.05fr 1fr;gap:16px;">
    <div class="card" style="margin-bottom:0;">
      <div class="rp-font-display card-title" style="margin-bottom:4px;">${esc(s.weightByTypeTitle)}</div>
      ${weightByTypeChart}
    </div>
    <div class="card" style="margin-bottom:0;">
      <div class="rp-font-display card-title" style="margin-bottom:10px;">${esc(s.statusDistributionTitle)}</div>
      ${statusDistribution}
    </div>
  </div>

  <div style="margin-top:10px;text-align:center;font-size:10px;color:${COLORS.muted};font-weight:600;">
    ${esc(s.footerNote)}
  </div>

</div>
</body>
</html>`;
}

/** Triggers a browser download of the generated report as an .html file. */
export function downloadMonthlyReport(stats: DashboardStats, pdrs: Pdr[], year: number, month: number): void {
  const html = generateMonthlyReportHtml(stats, pdrs, { year, month, generatedOn: new Date() });
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `informe-reciclaje-${year}-${String(month).padStart(2, "0")}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
