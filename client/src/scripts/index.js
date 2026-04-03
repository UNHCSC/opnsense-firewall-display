import { initializeDashboard } from "./lib/dashboard.js";
import { registerPWA } from "./lib/pwa.js";
import { createWorldMap } from "./lib/world-map.js";

const worldMap = createWorldMap();

registerPWA();

if (worldMap) {
    window.drawAnimatedArc = worldMap.drawArc;
    initializeDashboard(worldMap);
}
