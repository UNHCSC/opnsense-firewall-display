export async function registerPWA() {
    if (!("serviceWorker" in navigator)) {
        return null;
    }

    try {
        const registration = await navigator.serviceWorker.register("/service-worker.js", {
            scope: "/"
        });

        registration.update().catch(() => {});
        return registration;
    } catch (error) {
        console.warn("Failed to register service worker:", error);
        return null;
    }
}
