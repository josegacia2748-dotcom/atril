import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.jgarapps.atril",
  appName: "Atril",
  webDir: "dist",
  android: {
    backgroundColor: "#101418",
    allowMixedContent: false,
  },
  server: {
    androidScheme: "https",
  },
};

export default config;
