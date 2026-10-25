# Comparador de Primas

Sitio web estático para comparar la **prima directa** de dos compañías de seguros del mercado chileno, ramo por ramo, con los datos del *Informe Trimestral* (cifras en UF).

## Qué hace

- Elige **Seguros Generales** o **Seguros de Vida**.
- Selecciona dos compañías (A y B) y las intercambias con un clic.
- Ve el total de cada una, su participación de mercado, su ranking y la diferencia entre ambas.
- Gráfico de barras por ramo, en **UF** o como **% de la cartera** de cada compañía.
- En Vida puedes filtrar por línea de negocio (Individuales, Colectivos, Bancaseguros y Retail, Previsionales).
- Tabla de detalle con todos los ramos.
- La URL guarda la comparación (por ejemplo `#m=vida&a=MetLife&b=Confuturo`), así que puedes compartir un enlace directo.

## Estructura

```
├── index.html               Página principal
├── assets/
│   ├── style.css            Estilos (modo claro y oscuro)
│   └── app.js               Lógica y gráfico (SVG, sin dependencias)
├── data/
│   └── primas.json          Datos extraídos del Excel
└── scripts/
    └── extraer_datos.py     Convierte el Excel en data/primas.json
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

El navegador no carga el JSON si abres `index.html` con doble clic, así que levanta un servidor local:

```bash
python -m http.server 8000
```

y abre <http://localhost:8000>.

## Actualizar con un nuevo trimestre

Cuando tengas el informe del siguiente trimestre:

```bash
pip install openpyxl
python scripts/extraer_datos.py "Informe Trimestral 2026.09 - Web.xlsx"
git add data/primas.json && git commit -m "Datos 2026.09" && git push
```

El script lee las hojas `Gen. Prima Directa` y `Vida Prima Directa` (encabezado de compañías en la fila 11, ramos desde la fila 12 hasta "Total") y detecta solo la fecha de corte.

## Dependencias

Ninguna: HTML, CSS y JavaScript puro. El gráfico se dibuja en SVG, así que el sitio funciona sin conexión a CDNs.
