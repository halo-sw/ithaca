// Hybrid work helper: per-weekday home-office check (pure).
// Explicit home_office_days array wins over legacy home_office flag,
// including an explicit empty array overriding home_office === true.
export function isHomeOfficeDay(member, weekday) {
  if (!member || !Array.isArray(member.workdays) || !member.workdays.includes(weekday)) return false;
  if (Array.isArray(member.home_office_days)) return member.home_office_days.includes(weekday);
  return member.home_office === true;
}
