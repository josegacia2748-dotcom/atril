# Atril 🎼

**Gestión de partituras de orquesta para directores y músicos.**

Atril es una aplicación web pública que permite al director subir partituras en PDF, revisarlas con un lector OMR, asignarlas por instrumento y compartirlas con los músicos de la orquesta. Cada músico entra a su atril, ve únicamente el material de su instrumento, lo lee, lo descarga, lo imprime y lo escucha con el timbre de su familia instrumental.

- **Demo:** [atril-pi.vercel.app](https://atril-pi.vercel.app)
- **Repositorio:** [github.com/josegacia2748-dotcom/atril](https://github.com/josegacia2748-dotcom/atril)

---

## Funcionalidades

### Dirección

- Subida de **PDF**, **MusicXML** o generación de un **PDF de ejemplo** para probar el flujo completo.
- **Lector OMR propio**: binarización, detección de pentagramas, claves (sol, fa y do en 3.ª/4.ª), cabezas de nota, plicas, alteraciones y compases.
- Revisión del análisis con **nivel de confianza**, avisos y **corrección manual de la clave** antes de guardar.
- Edición de metadatos: título, compositor, arreglador, armadura, compás, tempo, clave y notas para los músicos.
- **Asignación por instrumento**: cuerdas, maderas, metales, teclados, percusión y voz; también «toda la orquesta».
- Biblioteca con búsqueda por título/compositor, filtro por instrumento y filtro «solo con OMR».
- Gestión de perfiles de músicos y dirección, y edición de los datos de la orquesta.

### Músicos

- Acceso con perfil propio e instrumento asignado.
- Solo ve las partituras asignadas a su instrumento.
- Lectura de la notación (OpenSheetMusicDisplay), del **PDF original** (pdf.js) y descarga/impresión.
- Cambio entre **parte escrita** y **sonido real (concierto)** con transposición automática.
- Reproductor con **timbre por familia instrumental**, control de tempo, pausa, detener y búsqueda en la línea de tiempo.
- Descarga de MusicXML y PDF generado cuando la partitura no tiene archivo adjunto.

### General

- Interfaz **en español**, responsive (escritorio, tablet y móvil con menú lateral deslizante).
- Tema oscuro «sala de conciertos» y tema claro «papel de partitura».
- Copia de seguridad JSON (perfiles, partituras y asignaciones).
- Funciona sin backend: los datos viven en el dispositivo del usuario.

---

## Cómo funciona el OMR

El análisis se ejecuta íntegramente en el navegador (`src/omr/`):

1. **Rasterizado** del PDF con pdf.js a escala 2×.
2. **Binarización** por umbral de Otsu y limpieza de ruido.
3. **Detección de pentagramas** por proyección horizontal de píxeles oscuros y agrupación de cinco líneas.
4. **Estimación de clave** por heurística sobre la distribución de tinta en el inicio del sistema; si no hay certeza se usa la clave de respaldo (sol) y se avisa al usuario, que puede corregirla.
5. **Detección de notas**: cabezas de nota por componentes conexas, plicas para estimar duración, alteraciones junto a la cabeza.
6. **Mapeo a alturas** según la clave efectiva (`pitchFromStaffStep`) y la armadura.
7. **Mapeo de compases** por barras de compás y generación de **MusicXML** (`eventsToXml`) para OSMD y para exportación.

El resultado se guarda junto a la partitura (`omr: { clef, confidence, notes, systems, warnings… }`) y se muestra en la ficha técnica.

> El OMR es una ayuda a la lectura, no un transcriptor profesional. Partituras manuscritas, densas o con varias voces por pentagrama pueden requerir corrección manual. La partitura PDF original siempre queda disponible.

---

## Transposición

Cada instrumento define en `src/lib/music.ts`:

- `transpose`: semitonos de **escrito → sonido real** (p. ej. clarinete en Si♭ = −2).
- `keyShift`: desplazamiento de armadura en quintas al pasar a sonido real.

En la vista de partitura:

- **Parte escrita**: se muestra lo que el músico lee, aplicando la transposición inversa (`−transpose`) y la armadura escrita.
- **Sonido real (concierto)**: se muestra la altura real de la obra.
- **Audio**: siempre sintetiza en sonido real, con el timbre de la familia del instrumento (cuerdas, maderas, metales, teclados, percusión o voz).

Las claves de sol, fa y do (3.ª y 4.ª) se interpretan de forma independiente para cada pentagrama.

---

## Stack

| Área | Tecnología |
| --- | --- |
| UI | React 19 + TypeScript |
| Build | Vite 8 |
| Enrutado | Hash routing propio (`src/lib/router.ts`) |
| Estado | Store propio con `useSyncExternalStore` |
| PDF | `pdfjs-dist` (visor y rasterizado OMR) |
| Notación | `opensheetmusicdisplay` (MusicXML → SVG) |
| Audio | `tone` (PolySynth + Transport) |
| PDF generado | `jspdf` |
| Persistencia | `localStorage` (metadatos) + IndexedDB (PDFs) |
| Android | Capacitor 8 (`@capacitor/core`, `@capacitor/cli`, `@capacitor/android`) |
| Escritorio | Electron 45 + electron-builder 26 (Windows) |
| Tests | Vitest |

---

## Desarrollo

Requiere Node.js 20+.

```bash
npm install
npm run dev        # servidor de desarrollo
npm run build      # typecheck + build de producción
npm run preview    # sirve dist en http://localhost:4180
npm test           # tests unitarios (Vitest)
npm run smoke      # smoke test E2E con Edge headless + CDP
```

El smoke test recorre el flujo completo: login, panel del director, análisis OMR del PDF de ejemplo, asignación de instrumentos, guardado, visor PDF, reproducción de audio, edición de asignaciones, acceso como músico, vista móvil y menú lateral. Genera capturas y `smoke-results.json` en `.preview/`.

```bash
npm run preview
npm run smoke -- http://localhost:4180/
```

---

## Android (APK) y escritorio (Windows)

El mismo código se empaqueta con **Capacitor** (Android) y **Electron** (Windows) sin cambiar la app web.

### Android

Requisitos: Android Studio con JDK 21+ y Android SDK 36.

```bash
npm run cap:sync      # build + copia dist/ al proyecto Android
npm run android       # build + abre Android Studio
npm run android:apk   # build + compila el APK de depuración con Gradle
```

- Proyecto nativo en `android/` (paquete `com.jgarapps.atril`).
- En Android Studio: **Build → Build Bundle(s)/APK(s) → Build APK(s)**. El APK queda en `android/app/build/outputs/apk/debug/`.
- Para publicar: **Build → Generate Signed Bundle/APK**.
- `AndroidManifest.xml` declara `INTERNET` y los permisos de almacenamiento heredados (Android ≤ 10). En Android 11+ los PDFs y respaldos se guardan en la carpeta de la app y se ofrecen con el selector del sistema (Descargas, Drive, WhatsApp…).
- La interfaz usa `viewport-fit=cover` y `env(safe-area-inset-*)`, por lo que respeta notch, bordes curvos y barras de gestos de Samsung, Xiaomi, Motorola, etc.

### Windows

```bash
npm run electron:dev            # Vite + Electron en caliente
npm run electron:build          # instalador NSIS en release/
npm run electron:build:portable # .exe portable en release/
npm run electron:build:dir      # carpeta sin instalador (release/win-unpacked)
```

- La build se carga con un protocolo propio `app://bundle` (origen seguro), así que `localStorage`, IndexedDB y las descargas funcionan igual que en la web.
- `contextIsolation: true`, `nodeIntegration: false` y `sandbox: true`.
- Las descargas abren el diálogo de Windows y se guardan en Descargas por defecto.
- La ventana principal mide 1360×900 (mínimo 1024×700) y usa un menú en español.

---

## Estructura

```
src/
  components/    Shell, UI, ScoreRenderer, PdfViewer, Player, ScoreCard, InstrumentPicker
  lib/
    music.ts       Instrumentos, claves, alturas, transposición, ritmo
    musicxml.ts    Generación y lectura de MusicXML
    audio.ts       OrchestraPlayer (Tone.js) y planificación de notas
    pdf.ts         Carga, rasterizado, descarga e impresión de PDF
    pdfgen.ts      PDF de ejemplo y PDF generado con jsPDF
    idb.ts         IndexedDB para archivos PDF
    store.ts       Estado, perfiles, partituras y persistencia
    seed.ts        Contenido de demostración
    router.ts      Rutas hash
  omr/
    analyze.ts     Pipeline OMR y conversión a eventos musicales
    pdf.ts         Puente pdf.js → análisis
  pages/         Login, DirectorHome, Upload, Library, Musicians, Settings,
                 MusicianHome, ScorePage, NotFound
  styles.css     Sistema de diseño y responsive
electron/
  main.cjs       Proceso principal: ventana, protocolo app://bundle, menú, descargas
  preload.cjs    Puente seguro con la interfaz (window.desktopApp)
android/         Proyecto Android generado por Capacitor (APK)
capacitor.config.ts  Identidad de la app Android (appId, webDir, scheme)
scripts/
  smoke.mjs        Prueba E2E con Edge headless y Chrome DevTools Protocol
  electron-dev.mjs Vite + Electron para desarrollo de escritorio
  android-apk.mjs  Compila el APK de depuración con el wrapper de Gradle
```

---

## Datos de demostración

La primera visita crea la **Orquesta Sinfónica de LUZ** (código `LUZ-2026`) con:

- 1 perfil de dirección (Maestra Elena Ríos).
- 8 músicos de distintos instrumentos.
- 4 partituras con asignaciones de ejemplo.

Se puede restablecer desde **Ajustes → Restablecer demostración**.

---

## Local-first: alcance y límite actual

Atril no tiene backend ni autenticación real:

- Los metadatos, perfiles y asignaciones se guardan en `localStorage` (clave `atril:v1`).
- Los PDFs se guardan en **IndexedDB** (`atril-files`).
- Por lo tanto, **los datos son propios de cada navegador/dispositivo**. Un músico que abre el enlace desde otro teléfono no verá los PDFs subidos por el director; verá el estado local de su propio navegador (o la demo inicial).

Esto hace que la demo pública sea inmediata y privada, pero para uso real en una orquesta hace falta sincronizar entre dispositivos. La ruta de mejora natural es:

1. Autenticación (Supabase/Auth.js) con roles director/músico.
2. Base de datos para perfiles, partituras y asignaciones.
3. Almacenamiento de objetos (S3/R2/Supabase Storage) para los PDFs.
4. Índice de partituras y búsqueda del lado del servidor.

El resto de la aplicación (OMR, notación, transposición, audio, visor) ya funciona en el cliente y se reutiliza tal cual.

---

## Despliegue

El proyecto está preparado para Vercel (`vercel.json`):

- **Build command:** `npm run build`
- **Output directory:** `dist`
- **Framework:** Vite

Cada push a `main` en GitHub redespliega automáticamente.

---

## Privacidad

Los archivos subidos no se envían a ningún servidor. Todo el procesamiento (OMR, notación, audio, generación de PDF) ocurre en el navegador.
