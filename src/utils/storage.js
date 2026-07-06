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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

export function upsertProject(projects, project) {
  const idx = projects.findIndex((p) => p.id === project.id);
  const next = [...projects];
  if (idx >= 0) next[idx] = project;
  else next.unshift(project);
  saveProjectsToStorage(next);
  return next;
}

export function deleteProject(projects, id) {
  const next = projects.filter((p) => p.id !== id);
  saveProjectsToStorage(next);
  return next;
}
