# Fichas Diseño

App de diseño **100% local e independiente** para crear fichas de estudio, esquemas, portadas y material visual.

## Características

- ✏️ **Texto** editable con distintas fuentes y tamaños
- 🖊️ **Dibujo libre** con lápiz
- 🔲 **Formas**: rectángulos, círculos, líneas, flechas
- 🖼️ **Imágenes** desde tu PC (arrastrar y soltar o botón)
- 🎨 **Fondo** de color o imagen
- 📐 **Tamaños de página**: A4, A5, ficha de estudio, cuadrado, apaisado, portada PDF
- 📚 **Capas** para organizar elementos
- ↩️ **Deshacer / Rehacer** (Ctrl+Z / Ctrl+Y)
- 💾 **Guardar proyectos** en el navegador (localStorage)
- 📤 **Exportar** a PNG, PDF o archivo de proyecto (.json)

## Cómo usar

```bash
npm install
npm run dev
```

Abre la URL que te indique (normalmente `http://localhost:5173`).

## Insertar tus propias figuras

1. Usa el botón **"Insertar figura / imagen"** en el panel derecho
2. O arrastra imágenes directamente al lienzo
3. Puedes guardar imágenes en `public/assets/shapes/` para usarlas como recursos

## Atajos

| Atajo | Acción |
|-------|--------|
| Ctrl+Z | Deshacer |
| Ctrl+Y | Rehacer |
| Supr | Eliminar seleccionado |

## Privacidad

Todo funciona en tu ordenador. No hay cuentas, ni nube, ni conexión a servicios externos.

## Publicar en GitHub Pages

La pantalla en blanco en GitHub suele pasar porque Pages sirve archivos estáticos y la app hay que **compilarla antes**.

### Pasos (una sola vez)

1. Sube el proyecto a GitHub (incluye la carpeta `public/assets/prefabricados/`).
2. En el repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Haz push a la rama `main` (o `master`). El workflow `.github/workflows/deploy-pages.yml` compila y publica solo.

### URL

Quedará en: `https://TU_USUARIO.github.io/NOMBRE-DEL-REPO/`

### Importante

- **No subas solo el código fuente** esperando que funcione: hace falta el build (`npm run build`).
- **No abras** `index.html` con doble clic; usa `npm run dev` en local.
- `node_modules` y `dist` no van al repo (el build se hace en GitHub Actions).
