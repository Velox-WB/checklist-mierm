# Evaluación de Control y Exposición Laboral — Mi ERM

Herramienta de cierre comercial: 25 controles basados en el Código de Trabajo
de Costa Rica, con scoring ponderado, reglas de ruptura y gráfico de telaraña
por dominio. Página estática de un solo archivo, sin backend.

## Estructura

```
index.html              ← la aplicación completa (HTML + CSS + JS en un solo archivo)
favicon.ico             ← favicon multi-tamaño (16/32/48px)
favicon-16x16.png
favicon-32x32.png
favicon-512x512.png
apple-touch-icon.png    ← ícono para iOS (180x180)
og-image.png            ← imagen para previews de WhatsApp/redes (1200x630)
vercel.json             ← cache headers para los assets estáticos
```

## Publicar en GitHub (vía navegador, sin terminal)

1. Creá un repositorio nuevo en GitHub (por ejemplo `evaluacion-control-exposicion-mierm`).
2. Entrá al repo → **Add file → Upload files**.
3. Arrastrá los 7 archivos de esta carpeta (todos, incluido `vercel.json`).
4. Commit directo a `main`.

## Conectar a Vercel

1. En Vercel → **Add New → Project** → importá el repositorio recién creado.
2. Framework Preset: **Other** (o "Static") — no hay build step, Vercel sirve `index.html` directo.
3. Deploy.

## Dominio

Las meta tags de Open Graph en `index.html` (líneas `og:url` y `og:image`)
están puestas con **`https://checklist.mierm.work/`** como dominio final.
Si el dominio cambia, hay que:

1. Actualizar esas dos líneas en `index.html`.
2. En Vercel → Project Settings → Domains → agregar el dominio.
3. En el proveedor de DNS de `mierm.work`, agregar el registro CNAME que
   Vercel indique para el subdominio elegido.

## Pendientes ya documentados en el propio código

- El formulario de contacto no envía datos a ningún backend/CRM todavía
  (queda en memoria del navegador). Ver comentario `NOTA PARA WARREN` en
  el `<script>` de `index.html`.
- El número de WhatsApp es un placeholder (`50600000000`). Buscar el
  comentario `NOTA:` junto a `wa.href` en `index.html`.
