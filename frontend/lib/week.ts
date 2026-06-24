export interface IsoWeek {
  year: number;
  week: number;
}

export function mondayOfWeek(w: IsoWeek): Date {
  const d = new Date(Date.UTC(w.year, 0, 4 + (w.week - 1) * 7));
  const dow = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - dow + 1);
  return d;
}

export function shiftWeek(w: IsoWeek, delta: number): IsoWeek {
  const mon = mondayOfWeek(w);
  mon.setUTCDate(mon.getUTCDate() + delta * 7);
  const thu = new Date(mon);
  thu.setUTCDate(thu.getUTCDate() + 3);
  const yearStart = new Date(Date.UTC(thu.getUTCFullYear(), 0, 1));
  const isoWeek = Math.ceil(((thu.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: thu.getUTCFullYear(), week: isoWeek };
}

export function formatWeekLabel(w: IsoWeek): string {
  const mon = mondayOfWeek(w);
  return `Semana del ${mon.toLocaleDateString("es-DO", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}`;
}
