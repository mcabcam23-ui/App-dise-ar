const STORAGE_KEY = 'fichas-diseño-proyectos';

export function loadProjectsFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveProjectsToStorage(projects) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    return { ok: true };
  } catch (err) {
    if (err?.name === 'QuotaExceededError') {
      return { ok: false, error: 'quota' };
    }
    return { ok: false, error: 'unknown' };
  }
}

export function upsertProject(projects, project) {
  const idx = projects.findIndex((p) => p.id === project.id);
  const next = [...projects];
  if (idx >= 0) next[idx] = project;
  else next.unshift(project);
  const result = saveProjectsToStorage(next);
  return { projects: next, ...result };
}

export function deleteProject(projects, id) {
  const next = projects.filter((p) => p.id !== id);
  const result = saveProjectsToStorage(next);
  return { projects: next, ...result };
}
