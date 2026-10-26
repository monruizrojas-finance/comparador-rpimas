# Comparador de Primas

Sitio web estático para comparar la **prima directa** de dos compañías de seguros del mercado chileno, ramo por ramo, con los datos del *Informe Trimestral* (cifras en UF).

## Qué hace

Cuatro pestañas con datos de **Seguros Generales**:

1. **Ranking de compañías**: prima directa, participación de mercado y participación acumulada de cada compañía. Se puede ordenar por columna y buscar por nombre.
2. **Comparador de prima**: elige dos compañías y compara su prima directa por ramo, en UF o como % de su cartera.
3. **Estado de resultados**: compara el estado de resultados de las mismas dos compañías, con gráfico de las líneas principales y tabla completa (con opción de ver subcuentas).
4. **Evolución entre períodos**: compara una misma compañía en dos períodos usando proporciones (participación de mercado, ranking, % de cartera por ramo e indicadores del estado de resultados como % de la prima directa).

Arriba a la derecha hay un selector de **período** (hoy: 30.06.2026 y 31.12.2025). Las cifras son acumuladas desde enero, así que un cierre de diciembre (12 meses) y uno de junio (6 meses) no se comparan directamente.

La URL guarda el período, la pestaña y las compañías elegidas, así que puedes compartir un enlace directo.

## Estructura

```
├── index.html               Página principal
├── assets/
│   ├── style.css            Estilos
│   └── app.js               Lógica y gráficos (SVG, sin dependencias)
├── data/
│   └── datos.js             Datos extraídos del Excel
└── scripts/
    └── extraer_datos.py     Convierte el Excel en data/datos.js
```

## Publicar en GitHub Pages

1. Crea un repositorio nuevo en GitHub (por ejemplo `comparador-primas`).
2. Sube el contenido de esta carpeta:
   ```bash
   git init
   git add .
   git commit -m "Comparador de primas"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/comparador-primas.git
   git push -u origin main
   ```
3. En GitHub ve a **Settings → Pages**, en *Source* elige **Deploy from a branch**, rama `main` y carpeta `/ (root)`. Guarda.
4. En uno o dos minutos el sitio queda en `https://TU_USUARIO.github.io/comparador-primas/`.

## Verlo en tu computador

Abre `index.html` con doble clic; no necesitas instalar nada.

## Agregar un nuevo período

Pasa al script **todos** los informes que quieras mostrar (cada uno queda como un período; el más reciente aparece primero):

```bash
pip install openpyxl
python scripts/extraer_datos.py "Informe Trimestral 2026.09 - Web.xlsx" "Informe Trimestral 2026.06 - Web.xlsx" "Informe Trimestral 2025.12 - Web.xlsx"
```

Luego sube el nuevo `data/datos.js` a GitHub.

El script lee las hojas `Gen. Prima Directa` y `Gen. EERR` (encabezado de compañías en la fila 11) y detecta solo la fecha de corte. En el estado de resultados aplica la columna "Signos" del informe para mostrar ingresos en positivo y costos en negativo.

## Dependencias

Ninguna: HTML, CSS y JavaScript puro. El gráfico se dibuja en SVG, así que el sitio funciona sin conexión a CDNs.
