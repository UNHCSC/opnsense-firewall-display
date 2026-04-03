import { FILTER_LOCAL_NETWORK_TRAFFIC, ACCEPTED_INTERFACES } from "./traffic-config.js";

const NORMALIZED_ACCEPTED_INTERFACES = ACCEPTED_INTERFACES.map((name) => name.trim().toLowerCase());

export function getEntryFromPayload(payload) {
    return payload?.entry ?? payload ?? null;
}

export function getGeolocationFromPayload(payload) {
    return payload?.geolocation ?? {};
}

export function isNullIslandCoordinate(longitude, latitude) {
    return longitude === 0 && latitude === 0;
}

export function getCoordinate(ipInfo) {
    const latitude = ipInfo?.city?.latitude;
    const longitude = ipInfo?.city?.longitude;

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return null;
    }

    if (isNullIslandCoordinate(longitude, latitude)) {
        return null;
    }

    return [longitude, latitude];
}

export function getDirection(entry) {
    const direction = entry?.direction?.toLowerCase();
    return direction === "in" || direction === "out" ? direction : null;
}

export function getAction(entry) {
    const action = entry?.action?.toLowerCase();
    return action === "pass" || action === "block" ? action : null;
}

export function getIPType(entry) {
    return entry?.ip_version === 6 ? "IPv6" : "IPv4";
}

export function getProtocolLabel(entry) {
    if (typeof entry?.protocol_text === "string" && entry.protocol_text.trim() !== "") {
        return entry.protocol_text.trim().toUpperCase();
    }

    if (Number.isFinite(entry?.protocol_id) && entry.protocol_id > 0) {
        return `PROTO ${entry.protocol_id}`;
    }

    return "OTHER";
}

export function normalizeInterfaceName(name) {
    return typeof name === "string" ? name.trim().toLowerCase() : "";
}

export function normalizeIP(ip) {
    return ip.trim().toLowerCase().split("%")[0];
}

function isLocalIPv4(ip) {
    const octets = ip.split(".").map(Number);
    if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
        return false;
    }

    if (octets[0] === 10 || octets[0] === 127) {
        return true;
    }

    if (octets[0] === 169 && octets[1] === 254) {
        return true;
    }

    if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) {
        return true;
    }

    return octets[0] === 192 && octets[1] === 168;
}

function isLocalIPv6(ip) {
    return ip === "::1"
        || ip.startsWith("fc")
        || ip.startsWith("fd")
        || ip.startsWith("fe8")
        || ip.startsWith("fe9")
        || ip.startsWith("fea")
        || ip.startsWith("feb");
}

export function isLocalNetworkIP(ip) {
    if (typeof ip !== "string" || ip.trim() === "") {
        return false;
    }

    const normalizedIP = normalizeIP(ip);
    return normalizedIP.includes(":") ? isLocalIPv6(normalizedIP) : isLocalIPv4(normalizedIP);
}

export function shouldFilterLocalNetworkTraffic(entry) {
    if (!FILTER_LOCAL_NETWORK_TRAFFIC) {
        return false;
    }

    return isLocalNetworkIP(entry?.src_ip) || isLocalNetworkIP(entry?.dst_ip);
}

export function shouldAcceptInterface(entry) {
    if (NORMALIZED_ACCEPTED_INTERFACES.length === 0) {
        return true;
    }

    const entryInterface = entry?.interface;
    if (typeof entryInterface !== "string" || entryInterface.trim() === "") {
        return false;
    }

    return NORMALIZED_ACCEPTED_INTERFACES.includes(normalizeInterfaceName(entryInterface));
}

export function shouldAcceptEntry(entry) {
    return Boolean(entry)
        && shouldAcceptInterface(entry)
        && !shouldFilterLocalNetworkTraffic(entry)
        && getDirection(entry) !== null;
}

function matchesEntryInterface(entry, interfaces = []) {
    if (!Array.isArray(interfaces) || interfaces.length === 0) {
        return true;
    }

    const entryInterface = normalizeInterfaceName(entry?.interface);
    return entryInterface !== "" && interfaces.includes(entryInterface);
}

export function shouldAcceptHistoryEntry(entry, filters = {}) {
    if (!entry || shouldFilterLocalNetworkTraffic(entry)) {
        return false;
    }

    const direction = getDirection(entry);

    return direction !== null
        && matchesEntryInterface(entry, filters.interfaces);
}

export function getAvailableInterfaces(entries) {
    return [...new Set(
        entries
            .map((entry) => normalizeInterfaceName(entry?.interface))
            .filter((name) => name !== "")
    )].sort((left, right) => left.localeCompare(right));
}

export function getRemoteAddress(entry) {
    const direction = getDirection(entry);

    if (direction === "out") {
        return entry?.dst_ip ?? null;
    }

    if (direction === "in") {
        return entry?.src_ip ?? null;
    }

    return null;
}

export function getRemotePort(entry) {
    const direction = getDirection(entry);

    if (direction === "out") {
        return Number.isInteger(entry?.dst_port) && entry.dst_port > 0 ? entry.dst_port : null;
    }

    if (direction === "in") {
        return Number.isInteger(entry?.src_port) && entry.src_port > 0 ? entry.src_port : null;
    }

    return null;
}

export function getRemoteIPInfo(entry, geolocation) {
    const direction = getDirection(entry);

    if (direction === "out") {
        return geolocation?.destination ?? null;
    }

    if (direction === "in") {
        return geolocation?.source ?? null;
    }

    return null;
}

export function getCountryLabel(ipInfo) {
    const countryName = ipInfo?.country?.country_name;
    const countryCode = ipInfo?.country?.country_iso_code || ipInfo?.city?.country_iso_code;

    if (countryName && countryCode) {
        return `${countryName} (${countryCode})`;
    }

    if (countryName) {
        return countryName;
    }

    return countryCode || null;
}

export function getTimestamp(entry) {
    const timestamp = new Date(entry?.timestamp ?? "");
    return Number.isNaN(timestamp.getTime()) ? null : timestamp;
}

export function getMinuteBucketKey(entry) {
    const timestamp = getTimestamp(entry);

    if (!timestamp) {
        return null;
    }

    timestamp.setSeconds(0, 0);
    return timestamp.getTime();
}
