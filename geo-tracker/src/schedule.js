import { startRun } from './runner.js';

// Optional recurring run (SCHEDULE_HOURS) so the dashboard can show a trend over time.
export function startSchedule() {
  const hours = Number(process.env.SCHEDULE_HOURS || 0);
  if (!hours) return;
  setInterval(() => {
    try {
      startRun({ label: 'הרצה מתוזמנת' });
    } catch (err) {
      console.error('scheduled run failed:', err.message);
    }
  }, hours * 3600 * 1000);
  console.log(`הרצה אוטומטית כל ${hours} שעות`);
}
