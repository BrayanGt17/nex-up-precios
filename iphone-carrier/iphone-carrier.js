(function () {
    const form = document.getElementById("carrier-form");
    const imeiInput = document.getElementById("imei");
    const serviceInput = document.getElementById("carrier-service");
    const fmiCompatibility = document.getElementById("fmi-compatibility");
    const submitButton = document.getElementById("carrier-submit");
    const result = document.getElementById("carrier-result");
    const resultTitle = document.getElementById("carrier-result-title");
    const status = document.getElementById("carrier-status");
    const output = document.getElementById("carrier-output");
    const copyButton = document.getElementById("copy-result");
    const copyFeedback = document.getElementById("copy-feedback");
    const historyList = document.getElementById("carrier-history-list");
    const historyEmpty = document.getElementById("carrier-history-empty");
    const historyFeedback = document.getElementById("carrier-history-feedback");
    const clearHistoryButton = document.getElementById("clear-history");
    const historyStorageKey = "nexUpIphoneCheckHistory";
    const historyLimit = 20;
    const hiddenProviderFields = new Set(["ip", "balance", "price", "id", "status"]);
    const safeColorNames = new Set([
        "aqua", "black", "blue", "cyan", "fuchsia", "gold", "gray", "green",
        "lime", "magenta", "maroon", "navy", "olive", "orange", "purple",
        "red", "silver", "teal", "white", "yellow"
    ]);
    let brandedResult = null;
    let historyEntries = [];

    function showResult(title, message, data) {
        result.hidden = false;
        resultTitle.textContent = title;
        status.textContent = message;
        const hasData = data !== undefined && data !== null;
        output.replaceChildren();
        if (hasData) {
            renderProviderResult(output, data);
        }
        output.hidden = !hasData;
        copyButton.hidden = !hasData;
        copyFeedback.textContent = "";
    }

    function buildBrandedResult(serviceName, imei, data) {
        const timestamp = new Intl.DateTimeFormat("es-GT", {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: "America/Guatemala"
        }).format(new Date());
        const plainDetails = providerResultToText(data);
        const plainText = [
            "NEX-UP | IPhone Check",
            "Consulta: " + serviceName,
            "IMEI: " + imei,
            "Fecha: " + timestamp,
            "",
            "RESULTADO",
            plainDetails,
            "",
            "nex-up.online"
        ].join("\n");

        const report = document.createElement("div");
        report.style.fontFamily = "Arial, sans-serif";
        report.style.color = "#192b42";

        const brand = document.createElement("h2");
        brand.textContent = "NEX-UP | IPhone Check";
        brand.style.color = "#087f8c";
        report.appendChild(brand);

        const details = document.createElement("p");
        details.textContent = "Consulta: " + serviceName + "\nIMEI: " + imei + "\nFecha: " + timestamp;
        details.style.whiteSpace = "pre-line";
        report.appendChild(details);

        const heading = document.createElement("h3");
        heading.textContent = "Resultado";
        report.appendChild(heading);

        const providerOutput = document.createElement("div");
        renderProviderResult(providerOutput, data);
        report.appendChild(providerOutput);

        const website = document.createElement("p");
        website.textContent = "nex-up.online";
        website.style.color = "#087f8c";
        report.appendChild(website);

        return { plainText, html: report.innerHTML };
    }

    function renderProviderResult(container, data) {
        if (typeof data === "string") {
            container.appendChild(sanitizeProviderMarkup(data));
            return;
        }

        container.textContent = JSON.stringify(data, null, 2) || "";
    }

    function prepareHistoryResult(data) {
        if (typeof data !== "string") {
            return removePrivateProviderFields(data);
        }

        const container = document.createElement("div");
        container.appendChild(sanitizeProviderMarkup(data));
        return container.innerHTML;
    }

    function getPublicProviderResult(data) {
        if (typeof data === "string") {
            const trimmedData = data.trim();
            if (trimmedData.startsWith("{") || trimmedData.startsWith("[")) {
                try {
                    return getPublicProviderResult(JSON.parse(trimmedData));
                } catch (error) {
                    if (!(error instanceof SyntaxError)) {
                        throw error;
                    }
                }
            }
            return data;
        }

        if (Array.isArray(data)) {
            return removePrivateProviderFields(data);
        }
        if (!data || typeof data !== "object") {
            return data;
        }

        if (Object.prototype.hasOwnProperty.call(data, "result")) {
            return getPublicProviderResult(data.result);
        }

        const publicFields = removePrivateProviderFields(data);
        return Object.keys(publicFields).length > 0 ? publicFields : "El proveedor no devolvió detalles.";
    }

    function removePrivateProviderFields(data) {
        if (Array.isArray(data)) {
            return data.map(removePrivateProviderFields);
        }
        if (!data || typeof data !== "object") {
            return data;
        }

        return Object.fromEntries(
            Object.entries(data)
                .filter(function (entry) {
                    return !hiddenProviderFields.has(entry[0].toLowerCase());
                })
                .map(function (entry) {
                    return [entry[0], removePrivateProviderFields(entry[1])];
                })
        );
    }

    function sanitizeProviderMarkup(markup) {
        const parsed = new DOMParser().parseFromString(markup, "text/html");
        const fragment = document.createDocumentFragment();
        appendSafeNodes(parsed.body, fragment);
        return fragment;
    }

    function appendSafeNodes(source, target) {
        Array.from(source.childNodes).forEach(function (node) {
            if (node.nodeType === Node.TEXT_NODE) {
                target.appendChild(document.createTextNode(node.nodeValue));
                return;
            }

            if (node.nodeType !== Node.ELEMENT_NODE) {
                return;
            }

            const tagName = node.tagName.toUpperCase();
            if (["SCRIPT", "STYLE", "IFRAME", "OBJECT", "SVG", "MATH"].includes(tagName)) {
                return;
            }

            const allowedTags = new Set(["B", "STRONG", "I", "EM", "BR", "P", "DIV", "SPAN", "FONT"]);
            if (!allowedTags.has(tagName)) {
                appendSafeNodes(node, target);
                return;
            }

            const safeTag = tagName === "FONT" ? "span" : tagName.toLowerCase();
            const safeNode = document.createElement(safeTag);
            if (tagName === "FONT") {
                const color = getSafeColor(node.getAttribute("color"));
                if (color) {
                    safeNode.style.color = color;
                }
            } else if (tagName === "SPAN") {
                const color = getSafeColor(node.style.color);
                if (color) {
                    safeNode.style.color = color;
                }
            }
            target.appendChild(safeNode);
            appendSafeNodes(node, safeNode);
        });
    }

    function getSafeColor(value) {
        const color = (value || "").trim().toLowerCase();
        if (safeColorNames.has(color) || /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(color)) {
            return color;
        }
        return "";
    }

    function providerResultToText(data) {
        if (typeof data !== "string") {
            return JSON.stringify(data, null, 2) || "";
        }

        const textContainer = document.createElement("div");
        textContainer.appendChild(sanitizeProviderMarkup(data));
        return textContainer.textContent.trim();
    }

    function isHistoryEntry(entry) {
        return Boolean(
            entry &&
            typeof entry === "object" &&
            typeof entry.imei === "string" &&
            /^\d{15}$/.test(entry.imei) &&
            typeof entry.serviceName === "string" &&
            typeof entry.createdAt === "string" &&
            !Number.isNaN(Date.parse(entry.createdAt)) &&
            entry.result !== undefined &&
            entry.result !== null
        );
    }

    function formatHistoryDate(value) {
        return new Intl.DateTimeFormat("es-GT", {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: "America/Guatemala"
        }).format(new Date(value));
    }

    function renderHistory() {
        historyList.replaceChildren();
        historyEntries.forEach(function (entry) {
            const item = document.createElement("li");
            item.className = "carrier-history-entry";

            const title = document.createElement("h3");
            title.textContent = entry.serviceName;
            item.appendChild(title);

            const details = document.createElement("p");
            details.className = "carrier-history-details";
            details.textContent = "IMEI: " + entry.imei + " | " + formatHistoryDate(entry.createdAt);
            item.appendChild(details);

            const savedResult = document.createElement("div");
            savedResult.className = "carrier-history-output";
            renderProviderResult(savedResult, entry.result);
            item.appendChild(savedResult);
            historyList.appendChild(item);
        });

        const hasHistory = historyEntries.length > 0;
        historyEmpty.hidden = hasHistory;
        historyList.hidden = !hasHistory;
        clearHistoryButton.disabled = !hasHistory;
    }

    function loadHistory() {
        let serializedHistory;
        try {
            serializedHistory = window.localStorage.getItem(historyStorageKey);
        } catch (error) {
            console.error("No se pudo acceder al historial local.", error);
            historyFeedback.textContent = "No se pudo acceder al historial guardado en este navegador.";
            renderHistory();
            return;
        }

        if (!serializedHistory) {
            renderHistory();
            return;
        }

        try {
            const savedEntries = JSON.parse(serializedHistory);
            if (!Array.isArray(savedEntries)) {
                throw new TypeError("El historial guardado no tiene el formato esperado.");
            }
            historyEntries = savedEntries.filter(isHistoryEntry).slice(0, historyLimit);
            if (historyEntries.length !== savedEntries.length) {
                historyFeedback.textContent = "Algunas consultas guardadas no se pudieron mostrar.";
            }
        } catch (error) {
            console.error("No se pudo leer el historial local.", error);
            historyFeedback.textContent = "No se pudo leer el historial guardado en este navegador.";
        }
        renderHistory();
    }

    function saveHistoryEntry(entry) {
        historyEntries = [entry].concat(historyEntries).slice(0, historyLimit);
        renderHistory();
        try {
            window.localStorage.setItem(historyStorageKey, JSON.stringify(historyEntries));
            historyFeedback.textContent = "Consulta guardada en este dispositivo.";
        } catch (error) {
            console.error("No se pudo guardar la consulta en el historial local.", error);
            historyFeedback.textContent = "No se pudo guardar en este dispositivo; la consulta seguirá visible mientras esta página esté abierta.";
        }
    }

    function clearHistory() {
        if (!historyEntries.length || !window.confirm("¿Borrar el historial guardado en este dispositivo?")) {
            return;
        }

        try {
            window.localStorage.removeItem(historyStorageKey);
        } catch (error) {
            console.error("No se pudo borrar el historial local.", error);
            historyFeedback.textContent = "No se pudo borrar el historial de este navegador.";
            return;
        }

        historyEntries = [];
        renderHistory();
        historyFeedback.textContent = "Historial borrado de este dispositivo.";
    }

    async function copyBrandedResult() {
        if (!brandedResult) {
            return;
        }

        try {
            if (
                window.isSecureContext &&
                navigator.clipboard &&
                navigator.clipboard.write &&
                typeof ClipboardItem !== "undefined"
            ) {
                try {
                    await navigator.clipboard.write([
                        new ClipboardItem({
                            "text/html": new Blob([brandedResult.html], { type: "text/html" }),
                            "text/plain": new Blob([brandedResult.plainText], { type: "text/plain" })
                        })
                    ]);
                    copyFeedback.textContent = "Resultado copiado.";
                    return;
                } catch (error) {
                    console.error("No se pudo copiar el formato enriquecido.", error);
                }
            }

            if (window.isSecureContext && navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(brandedResult.plainText);
            } else if (!copyWithSelection(brandedResult.plainText)) {
                throw new Error("El navegador no permitió copiar el resultado.");
            }
            copyFeedback.textContent = "Resultado copiado.";
        } catch (error) {
            console.error("No se pudo copiar el resultado.", error);
            copyFeedback.textContent = "No se pudo copiar. Selecciona y copia el resultado manualmente.";
        }
    }

    function copyWithSelection(text) {
        const temporaryInput = document.createElement("textarea");
        temporaryInput.value = text;
        temporaryInput.setAttribute("readonly", "");
        temporaryInput.style.position = "fixed";
        temporaryInput.style.opacity = "0";
        document.body.appendChild(temporaryInput);
        temporaryInput.select();
        try {
            return document.execCommand("copy");
        } finally {
            temporaryInput.remove();
        }
    }

    function updateFmiCompatibilityNotice() {
        fmiCompatibility.hidden = serviceInput.value !== "3";
    }

    serviceInput.addEventListener("change", updateFmiCompatibilityNotice);
    updateFmiCompatibilityNotice();
    loadHistory();
    clearHistoryButton.addEventListener("click", clearHistory);

    form.addEventListener("submit", async function (event) {
        event.preventDefault();
        const imei = imeiInput.value.trim();
        const service = serviceInput.value;
        const endpoint = window.NEX_UP_CONFIG && window.NEX_UP_CONFIG.iphoneCarrierApiUrl;
        const serviceNames = {
            "103": "Operador (Carrier)",
            "78": "Operador + estado de iCloud (Carrier + FMI)",
            "3": "Solo estado de iCloud (FMI)"
        };

        if (!/^\d{15}$/.test(imei)) {
            showResult("IMEI no válido", "Ingresa un IMEI de exactamente 15 dígitos.", null);
            imeiInput.focus();
            return;
        }

        if (!Object.prototype.hasOwnProperty.call(serviceNames, service)) {
            showResult("Consulta no válida", "Selecciona un tipo de consulta disponible.", null);
            serviceInput.focus();
            return;
        }

        if (!endpoint) {
            showResult(
                "Consulta no configurada",
                "El servicio todavía no está conectado al Worker de Cloudflare. Consulta las instrucciones de configuración.",
                null
            );
            return;
        }

        let endpointUrl;
        try {
            endpointUrl = new URL(endpoint);
        } catch (error) {
            console.error("La URL de consulta del carrier no es válida.", error);
            showResult("Error de configuración", "La dirección del servicio no es válida.", null);
            return;
        }

        if (endpointUrl.protocol !== "https:") {
            showResult("Error de configuración", "El servicio debe usar una conexión HTTPS segura.", null);
            return;
        }

        endpointUrl.searchParams.set("imei", imei);
        endpointUrl.searchParams.set("service", service);
        submitButton.disabled = true;
        submitButton.textContent = "Consultando...";
        showResult("Consulta en curso", "Estamos consultando " + serviceNames[service] + ".", null);

        try {
            const response = await fetch(endpointUrl.toString(), {
                method: "GET",
                headers: { Accept: "application/json" }
            });
            const payload = await response.json();

            if (!response.ok) {
                showResult(
                    "No se pudo completar la consulta",
                    payload.error || "El servicio respondió con un error. Inténtalo más tarde.",
                    null
                );
                return;
            }

            const publicResult = getPublicProviderResult(payload.result);
            brandedResult = buildBrandedResult(serviceNames[service], imei, publicResult);
            showResult(
                "Resultado: " + serviceNames[service],
                "Respuesta recibida. Consultas restantes hoy: " + payload.remaining + ".",
                publicResult
            );
            if (publicResult !== undefined && publicResult !== null) {
                saveHistoryEntry({
                    createdAt: new Date().toISOString(),
                    serviceName: serviceNames[service],
                    imei: imei,
                    result: prepareHistoryResult(publicResult)
                });
            }
        } catch (error) {
            console.error("Falló la consulta de carrier del iPhone.", error);
            showResult(
                "No se pudo conectar",
                "Verifica tu conexión o inténtalo más tarde. Si el problema continúa, revisa la configuración del Worker.",
                null
            );
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = "Consultar";
        }
    });

    copyButton.addEventListener("click", copyBrandedResult);
})();
