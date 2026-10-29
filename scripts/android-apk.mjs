// Compila el APK de depuración usando el wrapper de Gradle del proyecto Android.
// Requiere JDK 21+ y el SDK de Android (Android Studio).
import { spawnSync } from "node:child_process";

const isWindows = process.platform === "win32";
const gradlew = isWindows ? "gradlew.bat" : "./gradlew";
const result = spawnSync(gradlew, ["assembleDebug"], {
  cwd: "android",
  stdio: "inherit",
  shell: isWindows,
});

if (result.error) {
  console.error("No se pudo ejecutar Gradle:", result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
