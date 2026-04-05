import Chart from "chart.js/auto";
import {
    CHART_WINDOW_MINUTES
} from "./traffic-config.js";
import {
    getAction,
    getCountryLabel,
    getDirection,
    getEntryFromPayload,
    getGeolocationFromPayload,
    getIPType,
    getMinuteBucketKey,
    normalizeInterfaceName,
    getProtocolLabel,
    getRemotePort,
    getRemoteIPInfo,
    getTimestamp,
    shouldAcceptHistoryEntry
} from "./traffic-events.js";

const CHART_IDS = {
    ipType: "chart-ip-type",
    protocol: "chart-protocol",
    countries: "chart-top-countries",
    ports: "chart-top-ports",
    trafficTimeline: "chart-traffic-over-time",
    decisionTimeline: "chart-decisions-over-time"
};

const LEGEND_IDS = {
    ipType: "legend-chart-ip-type",
    protocol: "legend-chart-protocol",
    countries: "legend-chart-top-countries",
    ports: "legend-chart-top-ports",
    trafficTimeline: "legend-chart-traffic-over-time",
    decisionTimeline: "legend-chart-decisions-over-time"
};

const COLORS = {
    inbound: "#145634",
    outbound: "#004F9D",
    pass: "#008647",
    block: "#D2472F",
    ipv4: "#004F9D",
    ipv6: "#4C9BD5",
    slate: "#776D67",
    parchment: "#F5F4EC",
    sunrise: "#FEE7D7",
    spring: "#CBDB2A",
    deepBlue: "#001B43",
    chartGrid: "rgba(0, 27, 67, 0.08)",
    chartText: "rgba(0, 27, 67, 0.72)"
};

const LIVE_REFRESH_INTERVAL_MS = 250;
const LIVE_RETENTION_MS = CHART_WINDOW_MINUTES * 60 * 1000;
const MAX_LIVE_RECORDS = 6000;

Chart.defaults.color = COLORS.chartText;
Chart.defaults.font.family = "\"Helvetica Neue\", Helvetica, Arial, sans-serif";
Chart.defaults.plugins.legend.labels.usePointStyle = true;

const htmlLegendPlugin = {
    id: "htmlLegend",
    afterUpdate(chart, _args, options) {
        const container = document.getElementById(options.containerID);

        if (!container) {
            return;
        }

        let list = container.querySelector(".dashboard-card__legend-list");

        if (!list) {
            list = document.createElement("ul");
            list.className = "dashboard-card__legend-list";
            container.appendChild(list);
        }

        while (list.firstChild) {
            list.firstChild.remove();
        }

        const items = chart.options.plugins.legend.labels.generateLabels(chart);

        for (const item of items) {
            const listItem = document.createElement("li");
            listItem.className = "dashboard-card__legend-item";

            const swatch = document.createElement("span");
            swatch.className = "dashboard-card__legend-swatch";
            const swatchStyle = getLegendSwatchStyle(chart, item);
            swatch.style.background = swatchStyle.background;
            swatch.style.borderRadius = swatchStyle.borderRadius;
            swatch.style.width = swatchStyle.width;
            swatch.style.height = swatchStyle.height;
            swatch.style.flexBasis = swatchStyle.width;

            const label = document.createElement("span");
            label.className = "dashboard-card__legend-label";
            label.textContent = item.text;

            listItem.appendChild(swatch);
            listItem.appendChild(label);
            list.appendChild(listItem);
        }
    }
};

function getCanvas(id) {
    return document.getElementById(id);
}

function formatMinuteLabel(minuteKey) {
    return new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit"
    }).format(new Date(minuteKey));
}

function incrementCount(map, key, amount = 1) {
    map.set(key, (map.get(key) ?? 0) + amount);
}

function decrementCount(map, key, amount = 1) {
    const nextValue = (map.get(key) ?? 0) - amount;

    if (nextValue > 0) {
        map.set(key, nextValue);
        return;
    }

    map.delete(key);
}

function getSortedTopEntries(map, maxEntries = 5) {
    const sortedEntries = [...map.entries()].sort((left, right) => right[1] - left[1]);
    const topEntries = sortedEntries.slice(0, maxEntries);
    const remainderTotal = sortedEntries.slice(maxEntries).reduce((total, [, value]) => total + value, 0);

    if (remainderTotal > 0) {
        topEntries.push(["Other", remainderTotal]);
    }

    return topEntries;
}

function getLegendSwatchStyle(chart, item) {
    if (chart.config.type === "line") {
        return {
            background: item.strokeStyle,
            borderRadius: "0.28rem",
            width: "1rem",
            height: "0.52rem"
        };
    }

    return {
        background: item.fillStyle,
        borderRadius: "999px",
        width: "0.78rem",
        height: "0.78rem"
    };
}

function createPalette(count) {
    const palette = [
        COLORS.deepBlue,
        COLORS.outbound,
        COLORS.inbound,
        COLORS.pass,
        COLORS.spring,
        COLORS.sunrise,
        "#7C8CB5",
        "#68A691"
    ];

    return Array.from({ length: count }, (_, index) => palette[index % palette.length]);
}

function createDoughnutChart(canvas, { label, legendContainerID, labels = [], values = [], colors = [] }) {
    return new Chart(canvas, {
        type: "doughnut",
        plugins: [htmlLegendPlugin],
        data: {
            labels,
            datasets: [{
                label,
                data: values,
                backgroundColor: colors,
                borderColor: "rgba(255, 255, 255, 0.96)",
                borderWidth: 3,
                hoverOffset: 10,
                spacing: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                animateRotate: true,
                animateScale: true,
                duration: 1100,
                easing: "easeOutQuart"
            },
            plugins: {
                legend: {
                    display: false,
                    labels: {
                        boxWidth: 12,
                        color: COLORS.chartText,
                        padding: 14,
                        usePointStyle: true
                    }
                },
                tooltip: {
                    padding: 12,
                    callbacks: {
                        label: (context) => `${context.label}: ${context.parsed}`
                    }
                },
                htmlLegend: {
                    containerID: legendContainerID
                }
            },
            cutout: "62%"
        }
    });
}

function hexToRGBA(hex, alpha) {
    const normalizedHex = hex.replace("#", "");
    const red = Number.parseInt(normalizedHex.slice(0, 2), 16);
    const green = Number.parseInt(normalizedHex.slice(2, 4), 16);
    const blue = Number.parseInt(normalizedHex.slice(4, 6), 16);
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function createLineChart(canvas, legendContainerID, datasets) {
    return new Chart(canvas, {
        type: "line",
        plugins: [htmlLegendPlugin],
        data: {
            labels: [],
            datasets: datasets.map((dataset) => ({
                ...dataset,
                data: [],
                fill: true,
                borderWidth: 3,
                pointRadius: 0,
                pointHoverRadius: 4,
                pointHitRadius: 14,
                tension: 0.36
            }))
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 900,
                easing: "easeOutCubic"
            },
            interaction: {
                intersect: false,
                mode: "index"
            },
            plugins: {
                legend: {
                    display: false,
                    labels: {
                        color: COLORS.chartText,
                        usePointStyle: true,
                        boxWidth: 10,
                        padding: 16
                    }
                },
                htmlLegend: {
                    containerID: legendContainerID
                }
            },
            scales: {
                x: {
                    grid: {
                        color: "transparent"
                    },
                    ticks: {
                        color: COLORS.chartText,
                        maxRotation: 0,
                        autoSkipPadding: 18
                    }
                },
                y: {
                    beginAtZero: true,
                    grace: "10%",
                    grid: {
                        color: COLORS.chartGrid
                    },
                    ticks: {
                        color: COLORS.chartText,
                        precision: 0
                    }
                }
            }
        }
    });
}

export function createDashboardCharts() {
    const charts = {
        ipType: createDoughnutChart(getCanvas(CHART_IDS.ipType), {
            label: "IP Type",
            legendContainerID: LEGEND_IDS.ipType,
            labels: ["IPv4", "IPv6"],
            values: [0, 0],
            colors: [COLORS.ipv4, COLORS.ipv6]
        }),
        protocol: createDoughnutChart(getCanvas(CHART_IDS.protocol), {
            label: "Protocol",
            legendContainerID: LEGEND_IDS.protocol,
            labels: ["Waiting for data"],
            values: [1],
            colors: [COLORS.slate]
        }),
        countries: createDoughnutChart(getCanvas(CHART_IDS.countries), {
            label: "Top Countries",
            legendContainerID: LEGEND_IDS.countries,
            labels: ["Waiting for data"],
            values: [1],
            colors: [COLORS.slate]
        }),
        ports: createDoughnutChart(getCanvas(CHART_IDS.ports), {
            label: "Top Ports",
            legendContainerID: LEGEND_IDS.ports,
            labels: ["Waiting for data"],
            values: [1],
            colors: [COLORS.slate]
        }),
        trafficTimeline: createLineChart(getCanvas(CHART_IDS.trafficTimeline), LEGEND_IDS.trafficTimeline, [{
            label: "Inbound",
            borderColor: COLORS.inbound,
            backgroundColor: hexToRGBA(COLORS.inbound, 0.2)
        }, {
            label: "Outbound",
            borderColor: COLORS.outbound,
            backgroundColor: hexToRGBA(COLORS.outbound, 0.18)
        }]),
        decisionTimeline: createLineChart(getCanvas(CHART_IDS.decisionTimeline), LEGEND_IDS.decisionTimeline, [{
            label: "Pass",
            borderColor: COLORS.pass,
            backgroundColor: hexToRGBA(COLORS.pass, 0.18)
        }, {
            label: "Block",
            borderColor: COLORS.block,
            backgroundColor: hexToRGBA(COLORS.block, 0.18)
        }])
    };

    const state = {
        history: createEmptyState(),
        live: createEmptyState(),
        liveRecords: [],
        activeFilters: undefined
    };

    let destroyed = false;
    let pruneTimerId = 0;
    let refreshTimerId = 0;
    let refreshAnimated = false;

    function createEmptyState() {
        return {
            ipTypeCounts: new Map([["IPv4", 0], ["IPv6", 0]]),
            protocolCounts: new Map(),
            countryCounts: new Map(),
            portCounts: new Map(),
            minuteBuckets: new Map()
        };
    }

    function cloneCountMap(sourceMap) {
        return new Map(sourceMap);
    }

    function cloneMinuteBuckets(sourceMap) {
        return new Map(
            [...sourceMap.entries()].map(([minuteKey, bucket]) => [minuteKey, { ...bucket }])
        );
    }

    function cloneFilters(filters = undefined) {
        if (!filters) {
            return undefined;
        }

        return {
            ageSeconds: filters.ageSeconds,
            interfaces: Array.isArray(filters.interfaces) ? [...filters.interfaces] : []
        };
    }

    function matchesLiveRecordFilters(record, filters = undefined) {
        if (!filters?.interfaces || filters.interfaces.length === 0) {
            return true;
        }

        return record.interfaceName !== "" && filters.interfaces.includes(record.interfaceName);
    }

    function mergeCountMaps(...maps) {
        const mergedMap = new Map();

        for (const map of maps) {
            for (const [key, value] of map.entries()) {
                mergedMap.set(key, (mergedMap.get(key) ?? 0) + value);
            }
        }

        return mergedMap;
    }

    function mergeMinuteBuckets(...bucketMaps) {
        const mergedBuckets = new Map();

        for (const bucketMap of bucketMaps) {
            for (const [minuteKey, bucket] of bucketMap.entries()) {
                const mergedBucket = mergedBuckets.get(minuteKey) ?? {
                    inbound: 0,
                    outbound: 0,
                    pass: 0,
                    block: 0
                };

                mergedBucket.inbound += bucket.inbound;
                mergedBucket.outbound += bucket.outbound;
                mergedBucket.pass += bucket.pass;
                mergedBucket.block += bucket.block;
                mergedBuckets.set(minuteKey, mergedBucket);
            }
        }

        return mergedBuckets;
    }

    function getCombinedState() {
        return {
            ipTypeCounts: mergeCountMaps(state.history.ipTypeCounts, state.live.ipTypeCounts),
            protocolCounts: mergeCountMaps(state.history.protocolCounts, state.live.protocolCounts),
            countryCounts: mergeCountMaps(state.history.countryCounts, state.live.countryCounts),
            portCounts: mergeCountMaps(state.history.portCounts, state.live.portCounts),
            minuteBuckets: mergeMinuteBuckets(state.history.minuteBuckets, state.live.minuteBuckets)
        };
    }

    function replaceHistoryState(nextHistoryState) {
        state.history = {
            ipTypeCounts: cloneCountMap(nextHistoryState.ipTypeCounts),
            protocolCounts: cloneCountMap(nextHistoryState.protocolCounts),
            countryCounts: cloneCountMap(nextHistoryState.countryCounts),
            portCounts: cloneCountMap(nextHistoryState.portCounts),
            minuteBuckets: cloneMinuteBuckets(nextHistoryState.minuteBuckets)
        };
    }

    function trimMinuteBuckets(targetState) {
        const keys = [...targetState.minuteBuckets.keys()].sort((left, right) => left - right);
        const overflow = Math.max(0, keys.length - CHART_WINDOW_MINUTES);

        for (let index = 0; index < overflow; index += 1) {
            targetState.minuteBuckets.delete(keys[index]);
        }
    }

    function ensureMinuteBucket(targetState, minuteKey) {
        if (!targetState.minuteBuckets.has(minuteKey)) {
            targetState.minuteBuckets.set(minuteKey, {
                inbound: 0,
                outbound: 0,
                pass: 0,
                block: 0
            });
        }

        return targetState.minuteBuckets.get(minuteKey);
    }

    function applyRecord(targetState, record, delta = 1) {
        if (!record) {
            return;
        }

        if (delta > 0) {
            incrementCount(targetState.ipTypeCounts, record.ipType, delta);
            incrementCount(targetState.protocolCounts, record.protocol, delta);
            if (record.remotePort !== null) {
                incrementCount(targetState.portCounts, record.remotePort, delta);
            }
            if (record.country) {
                incrementCount(targetState.countryCounts, record.country, delta);
            }
        } else {
            decrementCount(targetState.ipTypeCounts, record.ipType, Math.abs(delta));
            decrementCount(targetState.protocolCounts, record.protocol, Math.abs(delta));
            if (record.remotePort !== null) {
                decrementCount(targetState.portCounts, record.remotePort, Math.abs(delta));
            }
            if (record.country) {
                decrementCount(targetState.countryCounts, record.country, Math.abs(delta));
            }
        }

        if (record.minuteKey === null) {
            return;
        }

        const bucket = delta > 0
            ? ensureMinuteBucket(targetState, record.minuteKey)
            : targetState.minuteBuckets.get(record.minuteKey);

        if (!bucket) {
            return;
        }

        const directionKey = record.direction === "in" ? "inbound" : "outbound";
        bucket[directionKey] += delta;

        if (record.action === "pass" || record.action === "block") {
            bucket[record.action] += delta;
        }

        if (bucket.inbound <= 0 && bucket.outbound <= 0 && bucket.pass <= 0 && bucket.block <= 0) {
            targetState.minuteBuckets.delete(record.minuteKey);
        } else {
            trimMinuteBuckets(targetState);
        }
    }

    function createLiveRecord(entry, remoteIPInfo = null) {
        if (!shouldAcceptHistoryEntry(entry)) {
            return null;
        }

        const direction = getDirection(entry);
        const timestamp = getTimestamp(entry);

        if (!direction || !timestamp) {
            return null;
        }

        const remotePort = getRemotePort(entry);

        return {
            action: getAction(entry),
            country: getCountryLabel(remoteIPInfo),
            direction,
            interfaceName: normalizeInterfaceName(entry?.interface),
            ipType: getIPType(entry),
            minuteKey: getMinuteBucketKey(entry),
            protocol: getProtocolLabel(entry),
            remotePort: remotePort === null ? null : String(remotePort),
            timestampMs: timestamp.getTime()
        };
    }

    function rebuildLiveState() {
        const nextLiveState = createEmptyState();

        for (const record of state.liveRecords) {
            if (matchesLiveRecordFilters(record, state.activeFilters)) {
                applyRecord(nextLiveState, record);
            }
        }

        state.live = nextLiveState;
    }

    function scheduleLivePrune(now = Date.now()) {
        if (pruneTimerId !== 0) {
            window.clearTimeout(pruneTimerId);
            pruneTimerId = 0;
        }

        if (destroyed || state.liveRecords.length === 0) {
            return;
        }

        const oldestRecord = state.liveRecords[0];
        const delayMs = Math.max(1000, oldestRecord.timestampMs + LIVE_RETENTION_MS - now);

        pruneTimerId = window.setTimeout(() => {
            pruneTimerId = 0;
            if (pruneLiveRecords()) {
                scheduleRefresh();
            }
        }, delayMs);
    }

    function pruneLiveRecords(now = Date.now()) {
        const cutoffMs = now - LIVE_RETENTION_MS;
        let removedAnyRecords = false;

        while (state.liveRecords.length > 0) {
            const oldestRecord = state.liveRecords[0];
            const overCapacity = state.liveRecords.length > MAX_LIVE_RECORDS;

            if (!overCapacity && oldestRecord.timestampMs >= cutoffMs) {
                break;
            }

            const expiredRecord = state.liveRecords.shift();
            if (matchesLiveRecordFilters(expiredRecord, state.activeFilters)) {
                applyRecord(state.live, expiredRecord, -1);
            }

            removedAnyRecords = true;
        }

        scheduleLivePrune(now);
        return removedAnyRecords;
    }

    function refreshCharts({ animate = false } = {}) {
        if (destroyed) {
            return;
        }

        refreshTimerId = 0;
        const updateMode = animate ? undefined : "none";
        const combinedState = getCombinedState();

        charts.ipType.data.datasets[0].data = [
            combinedState.ipTypeCounts.get("IPv4") ?? 0,
            combinedState.ipTypeCounts.get("IPv6") ?? 0
        ];
        charts.ipType.update(updateMode);

        const topProtocols = getSortedTopEntries(combinedState.protocolCounts, 5);
        charts.protocol.data.labels = topProtocols.map(([label]) => label);
        charts.protocol.data.datasets[0].data = topProtocols.map(([, value]) => value);
        charts.protocol.data.datasets[0].backgroundColor = createPalette(topProtocols.length);
        charts.protocol.update(updateMode);

        const topCountries = getSortedTopEntries(combinedState.countryCounts, 4);
        charts.countries.data.labels = topCountries.map(([label]) => label);
        charts.countries.data.datasets[0].data = topCountries.map(([, value]) => value);
        charts.countries.data.datasets[0].backgroundColor = createPalette(topCountries.length);
        charts.countries.update(updateMode);

        const topPorts = getSortedTopEntries(combinedState.portCounts, 5);
        charts.ports.data.labels = topPorts.map(([label]) => label);
        charts.ports.data.datasets[0].data = topPorts.map(([, value]) => value);
        charts.ports.data.datasets[0].backgroundColor = createPalette(topPorts.length);
        charts.ports.update(updateMode);

        const minuteKeys = [...combinedState.minuteBuckets.keys()].sort((left, right) => left - right);
        const minuteLabels = minuteKeys.map(formatMinuteLabel);
        const trafficInbound = [];
        const trafficOutbound = [];
        const decisionPass = [];
        const decisionBlock = [];

        for (const minuteKey of minuteKeys) {
            const bucket = combinedState.minuteBuckets.get(minuteKey);
            trafficInbound.push(bucket.inbound);
            trafficOutbound.push(bucket.outbound);
            decisionPass.push(bucket.pass);
            decisionBlock.push(bucket.block);
        }

        charts.trafficTimeline.data.labels = minuteLabels;
        charts.trafficTimeline.data.datasets[0].data = trafficInbound;
        charts.trafficTimeline.data.datasets[1].data = trafficOutbound;
        charts.trafficTimeline.data.datasets[0].backgroundColor = hexToRGBA(COLORS.inbound, 0.22);
        charts.trafficTimeline.data.datasets[1].backgroundColor = hexToRGBA(COLORS.outbound, 0.18);
        charts.trafficTimeline.update(updateMode);

        charts.decisionTimeline.data.labels = minuteLabels;
        charts.decisionTimeline.data.datasets[0].data = decisionPass;
        charts.decisionTimeline.data.datasets[1].data = decisionBlock;
        charts.decisionTimeline.data.datasets[0].backgroundColor = hexToRGBA(COLORS.pass, 0.18);
        charts.decisionTimeline.data.datasets[1].backgroundColor = hexToRGBA(COLORS.block, 0.18);
        charts.decisionTimeline.update(updateMode);
    }

    function scheduleRefresh({ animate = false } = {}) {
        if (destroyed) {
            return;
        }

        if (animate) {
            refreshAnimated = true;
            if (refreshTimerId !== 0) {
                window.clearTimeout(refreshTimerId);
                refreshTimerId = 0;
            }
        }

        if (refreshTimerId !== 0) {
            return;
        }

        const delayMs = refreshAnimated ? 0 : LIVE_REFRESH_INTERVAL_MS;
        refreshTimerId = window.setTimeout(() => {
            const shouldAnimate = refreshAnimated;
            refreshAnimated = false;
            refreshCharts({ animate: shouldAnimate });
        }, delayMs);
    }

    return {
        destroy() {
            destroyed = true;

            if (refreshTimerId !== 0) {
                window.clearTimeout(refreshTimerId);
                refreshTimerId = 0;
            }

            if (pruneTimerId !== 0) {
                window.clearTimeout(pruneTimerId);
                pruneTimerId = 0;
            }

            state.liveRecords.length = 0;

            for (const chart of Object.values(charts)) {
                chart.destroy();
            }
        },
        setHistory(entries, remoteIPInfoByAddress = new Map(), filters = undefined) {
            const nextHistoryState = createEmptyState();

            for (const entry of entries) {
                const remoteAddress = entry?.direction?.toLowerCase() === "out" ? entry?.dst_ip : entry?.src_ip;
                const remoteIPInfo = remoteIPInfoByAddress.get(remoteAddress) ?? null;
                const record = createLiveRecord(entry, remoteIPInfo);

                if (record && matchesLiveRecordFilters(record, filters)) {
                    applyRecord(nextHistoryState, record);
                }
            }

            state.activeFilters = cloneFilters(filters);
            replaceHistoryState(nextHistoryState);
            rebuildLiveState();
            scheduleRefresh({ animate: true });
        },
        ingestPayload(payload) {
            const entry = getEntryFromPayload(payload);
            const geolocation = getGeolocationFromPayload(payload);
            const remoteIPInfo = getRemoteIPInfo(entry, geolocation);
            const record = createLiveRecord(entry, remoteIPInfo);

            if (!record) {
                return;
            }

            state.liveRecords.push(record);

            if (matchesLiveRecordFilters(record, state.activeFilters)) {
                applyRecord(state.live, record);
            }

            pruneLiveRecords(record.timestampMs);
            scheduleRefresh();
        }
    };
}
