// Búsqueda de clientes en memoria (función pura, sin acceso a red).
import { Cliente } from './types';
import { normalizarTexto } from './converters';

/** Filtra clientes en memoria por nombre, teléfono, email o DNI. */
export const filtrarClientes = (clientes: Cliente[], searchTerm: string): Cliente[] => {
  const term = normalizarTexto(searchTerm.trim());
  if (!term) return clientes;
  return clientes
    .filter(
      (c) =>
        normalizarTexto(c.nombre || '').includes(term) ||
        (c.telefono || '').includes(searchTerm.trim()) ||
        normalizarTexto(c.email || '').includes(term) ||
        (c.dni || '').includes(searchTerm.trim())
    )
    .sort((a, b) => {
      const aStarts = normalizarTexto(a.nombre || '').startsWith(term);
      const bStarts = normalizarTexto(b.nombre || '').startsWith(term);
      if (aStarts !== bStarts) return aStarts ? -1 : 1;
      return (a.nombre || '').localeCompare(b.nombre || '');
    });
};

