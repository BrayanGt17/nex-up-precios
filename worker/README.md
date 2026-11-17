# Worker para consultar información de iPhone

El sitio usa este Worker como intermediario seguro para consultar Sickw. La clave de API debe permanecer como secreto de Cloudflare; nunca la incluyas en HTML, JavaScript del navegador ni en GitHub.

## Desplegar el Worker

Abre PowerShell en esta carpeta y ejecuta:

```powershell
npx wrangler secret put SICKW_API_KEY
npx wrangler deploy
```

Wrangler pedirá la clave de Sickw de forma interactiva. Si la clave se compartió públicamente, revócala en Sickw y registra una nueva como secreto.

## Consultas disponibles

- Operador / Carrier: servicio Sickw `103`.
- Operador + estado de iCloud / FMI: servicio `78`.
- Solo estado de iCloud / FMI: servicio `3`.

El Worker acepta IMEI de 15 dígitos y permite hasta 10 consultas diarias por IP, compartidas entre las tres modalidades. El contador se reinicia a medianoche, hora de Guatemala. La modalidad Solo FMI no es compatible con dispositivos únicamente Wi-Fi.

El límite se administra mediante un Durable Object con almacenamiento SQLite. El Worker conserva el contador diario asociado a un hash de la IP; no guarda los IMEI ni las respuestas. Sickw recibe el IMEI para procesar la consulta y puede tratarlo conforme a sus propias políticas.

Los intentos válidos cuentan aunque Sickw no devuelva resultados o haya un error de conexión.