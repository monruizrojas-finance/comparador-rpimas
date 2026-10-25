#!/usr/bin/env python3
"""
Extrae la Prima Directa por compañía y ramo desde el Informe Trimestral
(hojas "Gen. Prima Directa" y "Vida Prima Directa") y genera data/primas.json.

Uso:
    pip install openpyxl
    python scripts/extraer_datos.py "Informe Trimestral 2026.06 - Web.xlsx"
"""
import json
import re
import sys
import warnings
from pathlib import Path

import openpyxl

warnings.filterwarnings("ignore")

HOJAS = {
    "generales": ("Gen. Prima Directa", "Seguros Generales"),
    "vida": ("Vida Prima Directa", "Seguros de Vida"),
}
FILA_ENCABEZADO = 11
COL_INICIO = 3  # columna C


def limpiar(texto):
    return re.sub(r"\s+", " ", str(texto)).strip()


def num(v):
    return round(float(v), 2) if isinstance(v, (int, float)) else 0.0


def leer_hoja(ws):
    # Compañías: desde la columna C hasta la primera celda vacía
    companias, col = [], COL_INICIO
    while ws.cell(FILA_ENCABEZADO, col).value not in (None, ""):
        companias.append((col, limpiar(ws.cell(FILA_ENCABEZADO, col).value)))
        col += 1

    col_mercado = next(
        c for c in range(col, ws.max_column + 1)
        if limpiar(ws.cell(FILA_ENCABEZADO, c).value or "") == "Mercado"
    )

    ramos, seccion, fila_total = [], None, None
    for r in range(FILA_ENCABEZADO + 1, ws.max_row + 1):
        etiqueta = ws.cell(r, 2).value
        if etiqueta is None:
            continue
        etiqueta = limpiar(etiqueta)
        if etiqueta == "Total":
            fila_total = r
            break
        m = re.match(r"^([\d.]+)\s+(.*)$", etiqueta)
        if not m:  # encabezado de sección (p. ej. "Individuales")
            seccion = etiqueta
            continue
        valores = [num(ws.cell(r, c).value) for c, _ in companias]
        ramos.append({
            "codigo": m.group(1).rstrip("."),
            "nombre": m.group(2),
            "seccion": seccion,
            "mercado": num(ws.cell(r, col_mercado).value),
            "valores": valores,
        })

    totales = [num(ws.cell(fila_total, c).value) for c, _ in companias]
    return {
        "companias": [n for _, n in companias],
        "totales": totales,
        "mercado": num(ws.cell(fila_total, col_mercado).value),
        "ramos": ramos,
    }


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    wb = openpyxl.load_workbook(sys.argv[1], data_only=True, read_only=False)

    subtitulo = limpiar(wb[HOJAS["generales"][0]]["B9"].value)  # "Cifras en UF al 30.06.2026"
    fecha = subtitulo.split(" al ")[-1]

    salida = {"fecha": fecha, "unidad": "UF", "fuente": Path(sys.argv[1]).name, "mercados": {}}
    for clave, (hoja, titulo) in HOJAS.items():
        datos = leer_hoja(wb[hoja])
        datos["titulo"] = titulo
        salida["mercados"][clave] = datos
        print(f"{titulo}: {len(datos['companias'])} compañías, {len(datos['ramos'])} ramos")

    destino = Path(__file__).resolve().parent.parent / "data" / "primas.json"
    destino.write_text(json.dumps(salida, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Escrito {destino}")


if __name__ == "__main__":
    main()
