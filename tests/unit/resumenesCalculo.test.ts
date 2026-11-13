import { describe, expect, it } from 'vitest';
import { calcularResumenes, claveDia, combinarResumenes } from '../../src/firebase/resumenesCalculo';
import { Venta } from '../../src/firebase/types';

const venta = (id: string, fecha: Date, precio: number, cajeroId: string, servicioId: string): Venta => ({
  id,
  clienteId: 'c',
  clienteNombre: 'Cliente',
  servicioId,
  servicioNombre: servicioId === 's1' ? 'Corte' : 'Barba',
  precio,
  metodoPago: 'efectivo',
  cajeroId,
  cajeroNombre: cajeroId === 'a' ? 'Ana' : 'Beto',
  cajeroEmail: '',
  fecha,
  createdAt: fecha,
});

const d1 = new Date(2026, 10, 3, 10, 0);
const d1Noche = new Date(2026, 10, 3, 23, 59);
const d2 = new Date(2026, 10, 4, 9, 0);

const ventas = [
  venta('1', d1, 5000, 'a', 's1'),
  venta('2', d1Noche, 3000, 'b', 's2'),
  venta('3', d2, 5000, 'a', 's1'),
  venta('4', new Date(NaN), 999, 'a', 's1'), // fecha inválida: se ignora
];

describe('resúmenes de ventas', () => {
  it('claveDia usa la fecha local', () => {
    expect(claveDia(d1Noche)).toBe('2026-11-03');
  });

  it('agrupa por día, cajero y servicio', () => {
    const porDia = calcularResumenes(ventas);
    expect([...porDia.keys()].sort()).toEqual(['2026-11-03', '2026-11-04']);
    const dia = porDia.get('2026-11-03')!;
    expect(dia.total).toBe(8000);
    expect(dia.cantidad).toBe(2);
    expect(dia.porCajero.a).toMatchObject({ nombre: 'Ana', total: 5000, cantidad: 1 });
    expect(dia.porCajero.a.servicios.s1).toEqual({ nombre: 'Corte', cantidad: 1, total: 5000 });
    expect(dia.porServicio.s2).toEqual({ nombre: 'Barba', cantidad: 1, total: 3000 });
  });

  it('combinar los días equivale a calcular todo junto', () => {
    const mes = combinarResumenes([...calcularResumenes(ventas).values()]);
    expect(mes.total).toBe(13000);
    expect(mes.cantidad).toBe(3);
    expect(mes.porCajero.a).toMatchObject({ total: 10000, cantidad: 2 });
    expect(mes.porCajero.a.servicios.s1).toEqual({ nombre: 'Corte', cantidad: 2, total: 10000 });
    expect(mes.porServicio.s1.cantidad).toBe(2);
  });

  it('sin días devuelve totales en cero', () => {
    expect(combinarResumenes([])).toMatchObject({ total: 0, cantidad: 0, porCajero: {}, porServicio: {} });
  });
});
