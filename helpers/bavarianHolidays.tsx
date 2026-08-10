export type Holiday = {
  name: string;
  date: Date;
};

function getEaster(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month, day);
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function getUpcomingBavarianHolidays(limit: number = 5): Holiday[] {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  
  const currentYear = now.getFullYear();
  const years = [currentYear, currentYear + 1];

  const holidays: Holiday[] = [];

  for (const year of years) {
    const easter = getEaster(year);

    holidays.push({ name: "Neujahr", date: new Date(year, 0, 1) });
    holidays.push({ name: "Heilige Drei Könige", date: new Date(year, 0, 6) });
    holidays.push({ name: "Karfreitag", date: addDays(easter, -2) });
    holidays.push({ name: "Ostermontag", date: addDays(easter, 1) });
    holidays.push({ name: "Tag der Arbeit", date: new Date(year, 4, 1) });
    holidays.push({ name: "Christi Himmelfahrt", date: addDays(easter, 39) });
    holidays.push({ name: "Pfingstmontag", date: addDays(easter, 50) });
    holidays.push({ name: "Fronleichnam", date: addDays(easter, 60) });
    holidays.push({ name: "Mariä Himmelfahrt", date: new Date(year, 7, 15) });
    holidays.push({ name: "Tag der Deutschen Einheit", date: new Date(year, 9, 3) });
    holidays.push({ name: "Allerheiligen", date: new Date(year, 10, 1) });
    holidays.push({ name: "1. Weihnachtstag", date: new Date(year, 11, 25) });
    holidays.push({ name: "2. Weihnachtstag", date: new Date(year, 11, 26) });
  }

  return holidays
    .filter(h => h.date.getTime() >= now.getTime())
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, limit);
}