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

    function showResult(title, message, data) {
        result.hidden = false;
        resultTitle.textContent = title;
        status.textContent = message;
        output.textContent = data ? JSON.stringify(data, null, 2) : "";
        output.hidden = !data;
    }

    function updateFmiCompatibilityNotice() {
        fmiCompatibility.hidden = serviceInput.value !== "3";
    }

    serviceInput.addEventListener("change", updateFmiCompatibilityNotice);
    updateFmiCompatibilityNotice();

    form.addEventListener("submit", async function (event) {
        event.preventDefault();
        const imei = imeiInput.value.trim();
        const service = serviceInput.value;
        const endpoint = window.NEX_UP_CONFIG && window.NEX_UP_CONFIG.iphoneCarrierApiUrl;
        const serviceNames = {
            "103": "Carrier",
            "78": "Carrier + FMI",
            "3": "Solo FMI"
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

            showResult(
                "Resultado: " + serviceNames[service],
                "Respuesta recibida de Sickw. Consultas restantes hoy: " + payload.remaining + ".",
                payload.result
            );
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
})();
