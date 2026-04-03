export async function apiGetLogs(limit = 100) {
    const response = await fetch(`/api/v1/logs?limit=${encodeURIComponent(limit)}`);
    if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
    }

    return await response.json();
}

export async function apiGetLogsByAge(ageSeconds = 3600) {
    const response = await fetch(`/api/v1/logsByAge?ageSeconds=${encodeURIComponent(ageSeconds)}`);
    if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
    }

    return await response.json();
}

// Note: the emmitted json objects are formatted as { entry: <>, geolocation: { source: <>, destination: <> } }
export async function apiGetLogStream(onMessage, onClose, onError) {
    const eventSource = new EventSource("/api/v1/logStream");

    eventSource.onmessage = event => {
        const data = JSON.parse(event.data);
        onMessage(data);
    }

    eventSource.onerror = error => {
        if (eventSource.readyState === EventSource.CLOSED) {
            onClose();
        } else {
            onError(error);
        }
    }

    return eventSource;
}

export async function apiGetGeolocation(ip) {
    const response = await fetch(`/api/v1/geolocate?ip=${encodeURIComponent(ip)}`);
    if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
    }

    return await response.json();
}

export async function apiPostGeolocationMany(ips) {
    const response = await fetch("/api/v1/geolocateMany", {
        method: "POST",
        headers: {
            "Content-Type": "text/plain"
        },
        body: ips.join(",")
    });

    if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
    }

    return await response.json();
}

// Test functions

// function randomIPv4() {
//     return Array.from({ length: 4 }, () => Math.floor(Math.random() * 256)).join(".");
// }

// function randomIPv4NonPrivate() {
//     while (true) {
//         const ip = randomIPv4();
//         if (!/^10\.|^127\.|^172\.(1[6-9]|2[0-9]|3[0-1])\.|^192\.168\./.test(ip)) {
//             return ip;
//         }
//     }
// }

// function randomIPv6() {
//     return Array.from({ length: 8 }, () => Math.floor(Math.random() * 65536).toString(16)).join(":");
// }

// function randomIPv6NonPrivate() {
//     while (true) {
//         const ip = randomIPv6();
//         if (!/^fc|^fd|^fe80:/.test(ip)) {
//             return ip;
//         }
//     }
// }

// function randomIPsList(count) {
//     const ips = [];
//     for (let i = 0; i < count; i++) {
//         ips.push(Math.random() > .5 ? randomIPv4NonPrivate() : randomIPv6NonPrivate());
//     }

//     return ips;
// }
