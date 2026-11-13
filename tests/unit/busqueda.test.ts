import { describe, expect, it } from 'vitest';
import { filtrarClientes } from '../../src/firebase/busqueda';
import { Cliente } from '../../src/firebase/types';

const cliente = (id: string, nombre: string, extra: Partial<Cliente> = {}): Cliente => ({
  id,
  nombre,
  telefono: '11' + id,
  visitas: 0,
  puntos: 0,
  puntosCanjeados: 0,
  createdAt: new Date(0),
  ...extra,
});

const lista = [
  cliente('1', 'José Pérez', { dni: '30111222' }),
  cliente('2', 'María Gómez', { email: 'maria@mail.com' }),
  cliente('3', 'Ana María López'),
  cliente('4', 'Juan Martínez'),
];

describe('filtrarClientes', () => {
  it('ignora acentos y mayúsculas', () => {
    expect(filtrarClientes(lista, 'jose').map((c) => c.id)).toEqual(['1']);
    expect(filtrarClientes(lista, 'MARTINEZ').map((c) => c.id)).toEqual(['4']);
  });

  it('prioriza los nombres que empiezan con el término', () => {
    expect(filtrarClientes(lista, 'maria').map((c) => c.id)).toEqual(['2', '3']);
  });

  it('busca por DNI, teléfono y email', () => {
    expect(filtrarClientes(lista, '30111').map((c) => c.id)).toEqual(['1']);
    expect(filtrarClientes(lista, '114').map((c) => c.id)).toEqual(['4']);
    expect(filtrarClientes(lista, 'maria@').map((c) => c.id)).toEqual(['2']);
  });

  it('sin término devuelve la lista completa', () => {
    expect(filtrarClientes(lista, '  ')).toHaveLength(4);
  });
});
