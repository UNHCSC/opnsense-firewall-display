const DEFAULT_HISTORY_FILTERS = Object.freeze({
    ageSeconds: 3600,
    interfaces: []
});

function cloneFilters(filters = DEFAULT_HISTORY_FILTERS) {
    return {
        ageSeconds: filters.ageSeconds,
        interfaces: [...filters.interfaces]
    };
}

function selectInterfaceOptions(select, selectedInterfaces = []) {
    const selectedSet = new Set(selectedInterfaces);
    const useAllInterfaces = selectedSet.size === 0;

    for (const option of select.options) {
        option.selected = useAllInterfaces || selectedSet.has(option.value);
    }
}

function setOpenButtonsExpandedState(buttons, isExpanded) {
    for (const button of buttons) {
        button.setAttribute("aria-expanded", String(isExpanded));
    }
}

function normalizeAgeSeconds(value) {
    const numericValue = Number.parseInt(String(value), 10);

    if (!Number.isFinite(numericValue)) {
        return DEFAULT_HISTORY_FILTERS.ageSeconds;
    }

    return Math.min(Math.max(numericValue, 1), 365 * 24 * 3600);
}

export function createHistoryFiltersController({ onApply }) {
    const panel = document.getElementById("history-filters-panel");
    const form = document.getElementById("history-filters-form");
    const interfaceSelect = document.getElementById("history-filters-interfaces");
    const statusElement = document.getElementById("history-filters-status");
    const openButtons = [...document.querySelectorAll("[data-history-filters-open]")];
    const closeButtons = [...document.querySelectorAll("[data-history-filters-close]")];

    if (!panel || !form || !interfaceSelect) {
        return {
            getFilters() {
                return cloneFilters();
            },
            async applyCurrentFilters() {},
            syncInterfaces() {}
        };
    }

    let currentFilters = cloneFilters();
    let availableInterfaces = [];
    let isOpen = false;
    let isSubmitting = false;

    function setStatus(text = "") {
        if (statusElement) {
            statusElement.textContent = text;
        }
    }

    function openPanel() {
        panel.hidden = false;
        isOpen = true;
        setOpenButtonsExpandedState(openButtons, true);
    }

    function closePanel() {
        panel.hidden = true;
        isOpen = false;
        setOpenButtonsExpandedState(openButtons, false);
    }

    function readFiltersFromForm() {
        return {
            ageSeconds: normalizeAgeSeconds(form.elements.ageSeconds?.value),
            interfaces: [...interfaceSelect.selectedOptions].map((option) => option.value)
        };
    }

    function writeFiltersToForm(filters = currentFilters) {
        form.elements.ageSeconds.value = String(filters.ageSeconds);
        selectInterfaceOptions(interfaceSelect, filters.interfaces);
    }

    function setSubmitting(submitting) {
        isSubmitting = submitting;

        for (const element of Array.from(form.elements)) {
            element.disabled = submitting;
        }

        if (submitting) {
            setStatus("Loading history...");
        }
    }

    function syncInterfaces(interfaceNames = [], nextFilters = currentFilters) {
        availableInterfaces = [...interfaceNames];
        const normalizedInterfaceSet = new Set(availableInterfaces);
        const sanitizedInterfaces = nextFilters.interfaces.filter((name) => normalizedInterfaceSet.has(name));
        const effectiveFilters = {
            ...cloneFilters(nextFilters),
            interfaces: sanitizedInterfaces
        };

        interfaceSelect.replaceChildren();
        for (const interfaceName of availableInterfaces) {
            const option = document.createElement("option");
            option.value = interfaceName;
            option.textContent = interfaceName;
            interfaceSelect.appendChild(option);
        }

        currentFilters = effectiveFilters;
        writeFiltersToForm(currentFilters);
        return cloneFilters(currentFilters);
    }

    async function applyCurrentFilters({ closeAfterApply = false } = {}) {
        if (isSubmitting) {
            return currentFilters;
        }

        currentFilters = readFiltersFromForm();
        setSubmitting(true);

        try {
            const reconciledFilters = await onApply(cloneFilters(currentFilters));
            if (reconciledFilters) {
                currentFilters = cloneFilters(reconciledFilters);
                writeFiltersToForm(currentFilters);
            }
            setStatus("");

            if (closeAfterApply) {
                closePanel();
            }
        } catch (error) {
            console.error("Failed to apply history filters:", error);
            setStatus("Failed to reload history.");
        } finally {
            setSubmitting(false);
        }

        return cloneFilters(currentFilters);
    }

    for (const button of openButtons) {
        button.addEventListener("click", () => {
            const parentMenu = button.closest("details");
            if (parentMenu) {
                parentMenu.removeAttribute("open");
            }

            writeFiltersToForm(currentFilters);
            openPanel();
        });
    }

    for (const button of closeButtons) {
        button.addEventListener("click", () => closePanel());
    }

    panel.addEventListener("click", (event) => {
        if (event.target === panel) {
            closePanel();
        }
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && isOpen) {
            closePanel();
        }
    });

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        await applyCurrentFilters({ closeAfterApply: true });
    });

    form.addEventListener("reset", (event) => {
        event.preventDefault();
        currentFilters = cloneFilters(DEFAULT_HISTORY_FILTERS);
        writeFiltersToForm(currentFilters);
        setStatus("");
    });

    writeFiltersToForm(currentFilters);

    return {
        getFilters() {
            return cloneFilters(currentFilters);
        },
        applyCurrentFilters,
        syncInterfaces
    };
}

export { DEFAULT_HISTORY_FILTERS };
