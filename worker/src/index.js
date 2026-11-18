import { DurableObject } from "cloudflare:workers";

const ALLOWED_ORIGINS = new Set([
    "https://nex-up.online",
    "http://localhost:5500",
    "http://127.0.0.1:5500"
]);
const SICKW_SERVICES = new Set(["103", "78", "3"]);
const DAILY_QUERY_LIMIT = 10;

function jsonResponse(body, status, headers) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store",
            ...headers
        }
    });
}

export default {
    async fetch(request, env) {
        const requestUrl = new URL(request.url);
        const origin = request.headers.get("Origin");
        const isAllowedOrigin = origin && ALLOWED_ORIGINS.has(origin);
        const corsHeaders = isAllowedOrigin
            ? {
                  "Access-Control-Allow-Origin": origin,
                  "Access-Control-Allow-Methods": "GET, OPTIONS",
                  "Access-Control-Allow-Headers": "Accept",
                  Vary: "Origin"
              }
            : {};

        if (origin && !isAllowedOrigin) {
            return jsonResponse({ error: "Origen no autorizado." }, 403, {});
        }

        if (request.method === "OPTIONS") {
            return new Response(null, { status: 204, headers: corsHeaders });
        }

        if (request.method !== "GET" || requestUrl.pathname !== "/api/iphone-carrier") {
            return jsonResponse({ error: "Ruta no encontrada." }, 404, corsHeaders);
        }

        const deviceId = requestUrl.searchParams.get("imei") || requestUrl.searchParams.get("deviceId") || "";
        const isImei = /^\d{15}$/.test(deviceId);
        const isSerialNumber = /^[a-z0-9]{8,12}$/i.test(deviceId);
        const service = requestUrl.searchParams.get("service") || "103";
        if (!isImei && !isSerialNumber) {
            return jsonResponse(
                { error: "Ingresa un IMEI de 15 dígitos o un número de serie de 8 a 12 caracteres alfanuméricos." },
                400,
                corsHeaders
            );
        }

        if (!SICKW_SERVICES.has(service)) {
            return jsonResponse({ error: "El tipo de consulta seleccionado no es válido." }, 400, corsHeaders);
        }

        if (!env.SICKW_API_KEY) {
            return jsonResponse({ error: "La consulta de carrier no está configurada." }, 503, corsHeaders);
        }

        const clientIp = request.headers.get("CF-Connecting-IP");
        if (!clientIp) {
            return jsonResponse(
                { error: "No se pudo identificar al cliente para limitar las consultas." },
                400,
                corsHeaders
            );
        }

        let quota;
        try {
            const clientHash = await hashClientIp(clientIp);
            const limiterId = env.DAILY_LIMITER.idFromName(clientHash);
            const limiter = env.DAILY_LIMITER.get(limiterId);
            const limitResponse = await limiter.fetch("https://daily-limiter/check", { method: "POST" });
            quota = await limitResponse.json();
        } catch (error) {
            console.error("No se pudo comprobar el límite diario de consultas.", error);
            return jsonResponse(
                { error: "No se pudo comprobar el límite diario. Inténtalo más tarde." },
                503,
                corsHeaders
            );
        }

        if (!quota.allowed) {
            return jsonResponse(
                {
                    error: "Ya alcanzaste el límite de 10 consultas diarias por IP. Inténtalo mañana.",
                    remaining: 0,
                    resetsAt: quota.resetsAt
                },
                429,
                corsHeaders
            );
        }

        const sickwUrl = new URL("https://sickw.com/api.php");
        sickwUrl.searchParams.set("format", "json");
        sickwUrl.searchParams.set("key", env.SICKW_API_KEY);
        sickwUrl.searchParams.set("imei", isImei ? deviceId : deviceId.toUpperCase());
        sickwUrl.searchParams.set("service", service);

        const controller = new AbortController();
        const timeoutId = setTimeout(function () {
            controller.abort();
        }, 15000);

        try {
            const upstream = await fetch(sickwUrl.toString(), {
                method: "GET",
                redirect: "manual",
                signal: controller.signal
            });

            if (upstream.status >= 300 && upstream.status < 400) {
                console.error("Sickw redirected the carrier lookup; the redirect was not followed.");
                return jsonResponse(
                    { error: "El proveedor redirigió la consulta; no se siguió para proteger la clave de API." },
                    502,
                    corsHeaders
                );
            }

            if (!upstream.ok) {
                return jsonResponse(
                    { error: "El proveedor no pudo completar la consulta." },
                    502,
                    corsHeaders
                );
            }

            let result;
            try {
                result = await upstream.json();
            } catch (error) {
                console.error("Sickw returned an invalid JSON response.");
                return jsonResponse(
                    { error: "El proveedor devolvió una respuesta que no se pudo leer." },
                    502,
                    corsHeaders
                );
            }

            return jsonResponse({ result, remaining: quota.remaining }, 200, corsHeaders);
        } catch (error) {
            if (error.name === "AbortError") {
                return jsonResponse({ error: "El proveedor tardó demasiado en responder." }, 504, corsHeaders);
            }
            console.error("Carrier provider request failed.", error);
            return jsonResponse({ error: "No se pudo conectar con el proveedor." }, 502, corsHeaders);
        } finally {
            clearTimeout(timeoutId);
        }
    }
};

async function hashClientIp(clientIp) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(clientIp));
    return Array.from(new Uint8Array(digest), function (byte) {
        return byte.toString(16).padStart(2, "0");
    }).join("");
}

export class DailyRateLimiter extends DurableObject {
    constructor(ctx, env) {
        super(ctx, env);
        this.ctx = ctx;
        this.ctx.storage.sql.exec(
            "CREATE TABLE IF NOT EXISTS daily_usage (day TEXT PRIMARY KEY, count INTEGER NOT NULL)"
        );
    }

    async fetch(request) {
        if (request.method !== "POST") {
            return jsonResponse({ error: "Método no permitido." }, 405, { Allow: "POST" });
        }

        const today = guatemalaDateKey();
        this.ctx.storage.sql.exec("DELETE FROM daily_usage WHERE day <> ?", today);
        const rows = this.ctx.storage.sql.exec(
            `INSERT INTO daily_usage (day, count)
             VALUES (?, 1)
             ON CONFLICT(day) DO UPDATE SET count = daily_usage.count + 1
             WHERE daily_usage.count < ?
             RETURNING count`,
            today,
            DAILY_QUERY_LIMIT
        ).toArray();

        if (rows.length === 0) {
            return jsonResponse(
                { allowed: false, remaining: 0, resetsAt: nextGuatemalaMidnight(today) },
                429,
                {}
            );
        }

        return jsonResponse(
            { allowed: true, remaining: DAILY_QUERY_LIMIT - rows[0].count },
            200,
            {}
        );
    }
}

function guatemalaDateKey() {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Guatemala",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map(function (part) {
        return [part.type, part.value];
    }));
    return values.year + "-" + values.month + "-" + values.day;
}

function nextGuatemalaMidnight(date) {
    return new Date(date + "T06:00:00.000Z").toISOString();
}
