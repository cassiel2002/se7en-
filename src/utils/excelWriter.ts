// Adaptador mínimo para generar archivos .xlsx en el navegador con
// `write-excel-file` (reemplaza a `xlsx`, que tiene vulnerabilidades sin parche en npm).
//
// Se usa la variante "universal": genera un Blob sin Web Workers, compatible con la
// Content-Security-Policy del sitio.
import writeExcelFile from 'write-excel-file/universal';

export type Celda = string | number | null | undefined;

export interface Hoja {
  nombre: string;
  filas: Celda[][];
  /** Ancho de cada columna, en caracteres. */
  anchos?: number[];
}

export interface Libro {
  hojas: Hoja[];
}

export const crearLibro = (): Libro => ({ hojas: [] });

// Excel: máximo 31 caracteres, sin : \ / ? * [ ] y nombres únicos.
const nombreHojaValido = (nombre: string, usados: Set<string>): string => {
  const base = nombre.replace(/[:\\/?*[\]]/g, ' ').trim().slice(0, 31) || 'Hoja';
  let candidato = base;
  for (let i = 2; usados.has(candidato.toLowerCase()); i++) {
    const sufijo = ` (${i})`;
    candidato = base.slice(0, 31 - sufijo.length) + sufijo;
  }
  usados.add(candidato.toLowerCase());
  return candidato;
};

export const agregarHoja = (libro: Libro, nombre: string, filas: Celda[][], anchos?: number[]) => {
  libro.hojas.push({ nombre, filas, anchos });
};

const aCelda = (valor: Celda) => {
  if (valor === null || valor === undefined || valor === '') return null;
  if (typeof valor === 'number') return Number.isFinite(valor) ? { value: valor, type: Number } : null;
  return { value: String(valor), type: String };
};

/** Genera el archivo .xlsx y lo descarga en el navegador. */
export const descargarLibro = async (libro: Libro, nombreArchivo: string): Promise<void> => {
  if (libro.hojas.length === 0) throw new Error('El libro no tiene hojas');
  const usados = new Set<string>();
  const hojas = libro.hojas.map((hoja) => ({
    sheet: nombreHojaValido(hoja.nombre, usados),
    // Todas las filas con la misma cantidad de columnas.
    data: (() => {
      const ancho = Math.max(1, ...hoja.filas.map((f) => f.length));
      return hoja.filas.map((fila) => Array.from({ length: ancho }, (_, i) => aCelda(fila[i])));
    })(),
    columns: hoja.anchos?.map((width) => ({ width })),
  }));

  const blob = await writeExcelFile(hojas).toBlob();
  const url = URL.createObjectURL(blob);
  try {
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = nombreArchivo;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
};
