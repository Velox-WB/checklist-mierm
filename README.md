# Evaluación de Control y Exposición Laboral — Mi ERM

Herramienta de cierre comercial: 25 controles basados en el Código de Trabajo
de Costa Rica, con scoring ponderado, reglas de ruptura y gráfico de telaraña
por dominio. Frontend estático + una función serverless que genera el
análisis detallado con Claude y envía los dos correos (prospecto + Warren).

## Estructura

```
index.html              ← la aplicación (HTML + CSS + JS)
questions-data.json      ← las 25 preguntas, pesos y dominios — fuente única
                            que usan tanto el navegador como el backend
api/submit.js            ← función serverless: scoring + Claude + 2 correos
favicon.ico               favicon multi-tamaño (16/32/48px)
favicon-16x16.png
favicon-32x32.png
favicon-512x512.png
apple-touch-icon.png     ← ícono para iOS (180x180)
og-image.png             ← imagen para previews de WhatsApp/redes (1200x630)
vercel.json               cache headers + configuración de la función
.env.example              lista de variables de entorno necesarias (sin valores)
```

⚠️ **Si en algún momento cambian las preguntas**, hay que editarlas en
`questions-data.json` — no hace falta tocar nada más, tanto `index.html`
como `api/submit.js` las leen de ahí.

## Publicar en GitHub (vía navegador, sin terminal)

1. Creá un repositorio nuevo en GitHub (por ejemplo `evaluacion-control-exposicion-mierm`).
2. Entrá al repo → **Add file → Upload files**.
3. Arrastrá **todos** los archivos y carpetas de esta carpeta, incluida la
   carpeta `api/` completa con `submit.js` adentro (GitHub permite arrastrar
   la carpeta tal cual, respeta la ruta).
4. Commit directo a `main`.

## Conectar a Vercel

1. En Vercel → **Add New → Project** → importá el repositorio recién creado.
2. Framework Preset: **Other** — no hay build step.
3. **Antes de hacer Deploy**, expandí "Environment Variables" y cargá las
   4 variables de `.env.example` (ver siguiente sección para dónde
   conseguir cada una).
4. Deploy.

## Variables de entorno necesarias

En Vercel → Project Settings → Environment Variables, agregar:

| Variable | De dónde sale |
|---|---|
| `ANTHROPIC_API_KEY` | [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys) — crear una API key nueva |
| `RESEND_API_KEY` | [resend.com/api-keys](https://resend.com/api-keys) — requiere cuenta en Resend |
| `RESEND_FROM_EMAIL` | Formato `Mi ERM <info@warrenbenavides.com>` — usando el dominio que ya tenés verificado en Resend |
| `WARREN_EMAIL` | El correo donde querés recibir cada lead con su análisis completo |

**Importante sobre Resend:** si `warrenbenavides.com` ya está verificado en tu
cuenta de Resend, el envío debería funcionar de una vez. Si no estás seguro,
revisá [resend.com/domains](https://resend.com/domains) — el dominio tiene
que aparecer como "Verified", no "Pending".

**Importante sobre el tiempo de espera:** generar el análisis con Claude
más el envío de los dos correos puede tardar entre 10 y 25 segundos. Si el
proyecto está en el plan gratuito (Hobby) de Vercel, las funciones tienen un
límite de 10 segundos y esto podría fallar por timeout. Si eso pasa, hay que
pasar el proyecto a un plan Pro de Vercel (permite extender el límite a 30-60s,
ya configurado en `vercel.json`) — avisame si ves errores de timeout y lo
ajustamos.

## Dominio

Las meta tags de Open Graph en `index.html` (líneas `og:url` y `og:image`)
están puestas con **`https://checklist.mierm.work/`** como dominio final.
Si el dominio cambia, hay que:

1. Actualizar esas dos líneas en `index.html`.
2. En Vercel → Project Settings → Domains → agregar el dominio.
3. En el proveedor de DNS de `mierm.work`, agregar el registro CNAME que
   Vercel indique para el subdominio elegido.

## Pendiente ya documentado en el propio código

- El número de WhatsApp del botón final es un placeholder (`50600000000`).
  Buscar el comentario `NOTA:` junto a `wa.href` en el `<script>` de
  `index.html` y reemplazarlo por el número real de WhatsApp Business.
