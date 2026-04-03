import { ARC_COLORS, DEMO_POINTS, createWorldMap } from "./lib/world-map.js";

const worldMap = createWorldMap();

if (worldMap) {
    window.drawAnimatedArc = worldMap.drawArc;
    worldMap.startDemoTraffic({
        points: DEMO_POINTS,
        colors: ARC_COLORS
    });
}
