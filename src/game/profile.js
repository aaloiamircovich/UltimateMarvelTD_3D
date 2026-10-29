const KEY = "ultimate-marvel-td-profile-v1";
const fresh = () => ({
  version: 1,
  bestWave: 0,
  bestInfinite: 0,
  victories: 0,
  totalKills: 0,
  sound: true,
});
export function loadProfile(storage, { key = KEY, version = 1, maxWave = 12 } = {}) {
  const create = () => ({ ...fresh(), version });
  try {
    const raw = JSON.parse(storage.getItem(key));
    if (!raw || raw.version !== version) return create();
    const result = create();
    for (const k of ["bestWave", "bestInfinite", "victories", "totalKills"])
      if (Number.isSafeInteger(raw[k]) && raw[k] >= 0) result[k] = raw[k];
    result.bestWave = Math.min(maxWave, result.bestWave);
    if (typeof raw.sound === "boolean") result.sound = raw.sound;
    return result;
  } catch {
    return create();
  }
}
export function saveProfile(storage, profile, { key = KEY } = {}) {
  try {
    storage.setItem(key, JSON.stringify(profile));
    return true;
  } catch {
    return false;
  }
}
