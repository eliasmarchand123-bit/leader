const parseTimeToMs = (time = "") => {
  const raw = String(time).trim().toLowerCase().replace(/\s+/g, "");
  if (!raw) return 0;

  const colonFormat = /^\d{1,2}(:\d{1,2}){0,2}(\.\d{1,3})?$/;
  if (colonFormat.test(raw)) {
    const parts = raw.split(":");
    let hours = 0;
    let minutes = 0;
    let seconds = 0;
    let millis = 0;

    if (parts.length === 3) {
      hours = Number(parts[0]) || 0;
      minutes = Number(parts[1]) || 0;
      seconds = parts[2];
    } else if (parts.length === 2) {
      minutes = Number(parts[0]) || 0;
      seconds = parts[1];
    } else {
      seconds = parts[0];
    }

    if (typeof seconds === "string" && seconds.includes(".")) {
      const [secs, fraction] = seconds.split(".");
      seconds = Number(secs) || 0;
      millis = Number(fraction.padEnd(3, "0").slice(0, 3)) || 0;
    } else {
      seconds = Number(seconds) || 0;
    }

    return hours * 3600000 + minutes * 60000 + seconds * 1000 + millis;
  }

  const tokenRegex = /(\d+)(h|hr|hours|heure|heures|m|min|minute|minutes|s|sec|seconds|secondes|ms|msec|milliseconds|millisecondes)?/g;
  let match;
  let hours = 0;
  let minutes = 0;
  let seconds = 0;
  let millis = 0;
  let lastUnit = "";

  while ((match = tokenRegex.exec(raw)) !== null) {
    const value = Number(match[1] || 0);
    const unit = match[2] || "";

    if (!unit) {
      if (["m", "min", "minute", "minutes"].includes(lastUnit)) {
        seconds = seconds || value;
      } else if (["s", "sec", "seconds", "secondes"].includes(lastUnit)) {
        millis = millis || value;
      } else if (!seconds) {
        seconds = value;
      } else if (!millis) {
        millis = value;
      }
      continue;
    }

    if (["h", "hr", "hours", "heure", "heures"].includes(unit)) {
      hours = value;
      lastUnit = "h";
    } else if (["m", "min", "minute", "minutes"].includes(unit)) {
      minutes = value;
      lastUnit = "m";
    } else if (["s", "sec", "seconds", "secondes"].includes(unit)) {
      seconds = value;
      lastUnit = "s";
    } else if (["ms", "msec", "milliseconds", "millisecondes"].includes(unit)) {
      millis = value;
      lastUnit = "ms";
    }
  }

  return hours * 3600000 + minutes * 60000 + seconds * 1000 + millis;
};

const tests = [
  '2h',
  '55min32',
  '2h42m57s367ms',
  '1h30m',
  '54min32',
  '55min34',
  '22min'
];

for (const t of tests) {
  console.log(t, parseTimeToMs(t));
}
