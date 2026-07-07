export function dateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayStr() {
  return dateStr(new Date());
}

export function daysBetween(a, b) {
  return Math.round((parseDate(dateStr(b)) - parseDate(dateStr(a))) / 86400000) + 1;
}

export function escHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

export function getChallengeEnd(ch) {
  if (!ch) return null;
  const d = parseDate(ch.startDate);
  d.setDate(d.getDate() + ch.days - 1);
  return d;
}

export function getEntry(progressData, date, habitId) {
  return (progressData[habitId] || {})[dateStr(date)] || 0;
}

export function setEntry(progressData, date, habitId, val) {
  if (!progressData[habitId]) progressData[habitId] = {};
  progressData[habitId][dateStr(date)] = val;
}

export function calcStreak(progressData, habitId) {
  const entries = progressData[habitId] || {};
  let streak = 0;
  const d = new Date();
  while (true) {
    const s = dateStr(d);
    if ((entries[s] || 0) > 0) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else break;
  }
  return streak;
}

export function formatDateNice(d) {
  const t = new Date();
  const ds = dateStr(d);
  const ts = dateStr(t);
  if (ds === ts) return 'Today';
  const y = new Date(t);
  y.setDate(y.getDate() - 1);
  if (ds === dateStr(y)) return 'Yesterday';
  const tom = new Date(t);
  tom.setDate(tom.getDate() + 1);
  if (ds === dateStr(tom)) return 'Tomorrow';
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() !== t.getFullYear() ? 'numeric' : undefined
  });
}

export function validatePassword(password) {
  const rules = [
    { key: 'length', test: password.length >= 8, label: 'At least 8 characters' },
    { key: 'upper', test: /[A-Z]/.test(password), label: 'One uppercase letter' },
    { key: 'lower', test: /[a-z]/.test(password), label: 'One lowercase letter' },
    { key: 'number', test: /[0-9]/.test(password), label: 'One number' },
    { key: 'special', test: /[^A-Za-z0-9]/.test(password), label: 'One special character (e.g. !@#$%)' }
  ];
  const allMet = rules.every(r => r.test);
  return { rules, allMet };
}

export function getChallenges(defaultsData, userChallengesData, allChallengesData) {
  const defaults = (defaultsData && defaultsData.challenges) || [];
  const users = (userChallengesData && userChallengesData.challenges) || [];
  const all = (allChallengesData && allChallengesData.challenges) || [];
  const seen = new Set();
  const merged = [];
  for (const c of defaults) { merged.push({ ...c, _source: 'default' }); if (c._id) seen.add(String(c._id)); }
  for (const c of users) { merged.push({ ...c, _source: 'user' }); if (c._id) seen.add(String(c._id)); }
  for (const c of all) {
    const id = c._id ? String(c._id) : ((c._source || 'unknown') + ':' + c.id);
    if (!seen.has(id)) {
      merged.push({ ...c, _source: c._source || 'community' });
      seen.add(id);
    }
  }
  return merged;
}

export function getActiveChallenge(defaultsData, userChallengesData, allChallengesData) {
  const list = getChallenges(defaultsData, userChallengesData, allChallengesData);
  if (!list.length) return null;
  // Check active in allChallengesData first (most complete source)
  if (allChallengesData && allChallengesData.activeChallengeId && allChallengesData.activeSource) {
    const f = list.find(c => c._source === allChallengesData.activeSource && c.id === allChallengesData.activeChallengeId);
    if (f) return f;
  }
  if (defaultsData && defaultsData.activeChallengeId) {
    const f = list.find(c => c._source === 'default' && c.id === defaultsData.activeChallengeId);
    if (f) return f;
  }
  if (userChallengesData && userChallengesData.activeChallengeId) {
    const f = list.find(c => c._source === 'user' && c.id === userChallengesData.activeChallengeId);
    if (f) return f;
  }
  return list[0] || null;
}

export function getActiveHabits(defaultsData, userChallengesData, allChallengesData) {
  const c = getActiveChallenge(defaultsData, userChallengesData, allChallengesData);
  return c ? c.habits : [];
}

export const COLORS = ['#ff8c42', '#2ecc71', '#e74c3c', '#f39c12', '#3498db', '#e91e63', '#00bcd4', '#ff9800', '#9c27b0', '#4caf50'];
