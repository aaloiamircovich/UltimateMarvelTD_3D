const KEY = "ultimate-marvel-td-profile-v1";
const fresh = () => ({
  version: 1,
  bestWave: 0,
  bestInfinite: 0,
  victories: 0,
  totalKills: 0,
  sound: true,
});
export function loadProfile(storage) {
  try {
    const raw = JSON.parse(storage.getItem(KEY));
    if (!raw || raw.version !== 1) return fresh();
    const result = fresh();
    for (const k of ["bestWave", "bestInfinite", "victories", "totalKills"])
      if (Number.isSafeInteger(raw[k]) && raw[k] >= 0) result[k] = raw[k];
    result.bestWave = Math.min(12, result.bestWave);
    if (typeof raw.sound === "boolean") result.sound = raw.sound;
    return result;
  } catch {
    return fresh();
  }
}
export function saveProfile(storage, profile) {
  try {
    storage.setItem(KEY, JSON.stringify(profile));
    return true;
  } catch {
    return false;
  }
}
