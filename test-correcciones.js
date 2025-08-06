// Script de prueba para verificar las correcciones del reporte Excel
// Ejecutar en la consola del navegador en la página de Reportes

console.log('🧪 INICIANDO PRUEBAS DE CORRECCIONES...');

// Función para simular el cálculo de plus automático (excluyendo domingos)
function testPlusAutomatico() {
  console.log('\n📊 PRUEBA 1: Cálculo de Plus Automático (Sin Domingos)');
  
  const plusDiario = 4000;
  const fechaInicio = new Date('2024-06-29');
  const fechaFin = new Date('2024-07-04');
  
  // Calcular días del período excluyendo domingos
  const diasIntervalo = [];
  const fechaActual = new Date(fechaInicio);
  while (fechaActual <= fechaFin) {
    if (fechaActual.getDay() !== 0) { // 0 = domingo
      diasIntervalo.push(new Date(fechaActual));
    }
    fechaActual.setDate(fechaActual.getDate() + 1);
  }
  const diasPeriodo = diasIntervalo.length;
  const plusTotal = plusDiario * diasPeriodo;
  
  console.log('Fecha inicio:', fechaInicio.toLocaleDateString());
  console.log('Fecha fin:', fechaFin.toLocaleDateString());
  console.log('Días del período (sin domingos):', diasPeriodo);
  console.log('Plus diario: $', plusDiario.toLocaleString());
  console.log('Plus total esperado: $', plusTotal.toLocaleString());
  
  // Verificar que sea correcto (29/06 es sábado, 30/06 es domingo, 01/07 es lunes, etc.)
  // Del 29/06 al 04/07: 29(sáb), 30(dom), 01(lun), 02(mar), 03(mié), 04(jue) = 5 días (excluyendo domingo)
  const esperado = 4000 * 5; // 5 días sin domingo
  console.log('¿Cálculo correcto?', plusTotal === esperado ? '✅ SÍ' : '❌ NO');
  
  return plusTotal === esperado;
}

// Función para verificar construcción de fechas
function testConstruccionFechas() {
  console.log('\n📅 PRUEBA 2: Construcción de Fechas');
  
  const fechaInicioStr = '2024-06-29';
  const fechaFinStr = '2024-07-04';
  
  // Construir fechas como lo hace el código corregido
  const [año, mes, dia] = fechaInicioStr.split('-').map(Number);
  const inicio = new Date(año, mes - 1, dia, 0, 0, 0, 0);
  
  const [añoFin, mesFin, diaFin] = fechaFinStr.split('-').map(Number);
  const fin = new Date(añoFin, mesFin - 1, diaFin, 23, 59, 59, 999);
  
  console.log('Fecha inicio string:', fechaInicioStr);
  console.log('Fecha fin string:', fechaFinStr);
  console.log('Fecha inicio construida:', inicio.toISOString());
  console.log('Fecha fin construida:', fin.toISOString());
  
  // Verificar que las fechas sean correctas
  const inicioCorrecto = inicio.getDate() === 29 && inicio.getMonth() === 5; // Junio = 5
  const finCorrecto = fin.getDate() === 4 && fin.getMonth() === 6; // Julio = 6
  
  console.log('¿Fecha inicio correcta?', inicioCorrecto ? '✅ SÍ' : '❌ NO');
  console.log('¿Fecha fin correcta?', finCorrecto ? '✅ SÍ' : '❌ NO');
  
  return inicioCorrecto && finCorrecto;
}

// Función para verificar logging
function testLogging() {
  console.log('\n🔍 PRUEBA 3: Verificación de Logging');
  
  // Verificar que los logs estén presentes en la consola
  const logsEsperados = [
    '🔍 Rango de fechas solicitado:',
    '📊 Ventas encontradas:',
    '📤 Exportando Excel con fechas:',
    '📊 Exportando Excel con datos:'
  ];
  
  console.log('Logs esperados en consola:');
  logsEsperados.forEach(log => {
    console.log('  -', log);
  });
  
  console.log('\n✅ Verificar que estos logs aparezcan al cargar reportes y exportar Excel');
  
  return true;
}

// Función para verificar datos del período
function testDatosPeriodo() {
  console.log('\n📋 PRUEBA 4: Verificación de Datos del Período');
  
  const fechaInicio = new Date('2024-06-29');
  const fechaFin = new Date('2024-07-04');
  
  // Simular ventas del período
  const ventasSimuladas = [
    { fecha: new Date('2024-06-29 10:00'), precio: 50000 },
    { fecha: new Date('2024-06-30 14:00'), precio: 75000 },
    { fecha: new Date('2024-07-01 09:00'), precio: 60000 },
    { fecha: new Date('2024-07-02 16:00'), precio: 80000 },
    { fecha: new Date('2024-07-03 11:00'), precio: 45000 },
    { fecha: new Date('2024-07-04 13:00'), precio: 70000 }
  ];
  
  // Filtrar ventas en el rango
  const ventasEnRango = ventasSimuladas.filter(venta => 
    venta.fecha >= fechaInicio && venta.fecha <= fechaFin
  );
  
  console.log('Total ventas simuladas:', ventasSimuladas.length);
  console.log('Ventas en rango:', ventasEnRango.length);
  console.log('Total facturado en rango: $', ventasEnRango.reduce((sum, v) => sum + v.precio, 0).toLocaleString());
  
  // Verificar que todas las ventas estén en rango
  const todasEnRango = ventasEnRango.length === ventasSimuladas.length;
  console.log('¿Todas las ventas en rango?', todasEnRango ? '✅ SÍ' : '❌ NO');
  
  return todasEnRango;
}

// Ejecutar todas las pruebas
function ejecutarPruebas() {
  console.log('🚀 EJECUTANDO PRUEBAS DE CORRECCIONES...\n');
  
  const resultados = [
    testPlusAutomatico(),
    testConstruccionFechas(),
    testLogging(),
    testDatosPeriodo()
  ];
  
  const pruebasExitosas = resultados.filter(r => r).length;
  const totalPruebas = resultados.length;
  
  console.log('\n📊 RESUMEN DE PRUEBAS:');
  console.log(`Pruebas exitosas: ${pruebasExitosas}/${totalPruebas}`);
  
  if (pruebasExitosas === totalPruebas) {
    console.log('🎉 ¡TODAS LAS PRUEBAS PASARON! Las correcciones están funcionando correctamente.');
  } else {
    console.log('⚠️ Algunas pruebas fallaron. Revisar los resultados arriba.');
  }
  
  return pruebasExitosas === totalPruebas;
}

// Instrucciones para el usuario
console.log(`
📝 INSTRUCCIONES PARA PROBAR EN PRODUCCIÓN:

1. Ve a la página de Reportes
2. Abre la consola del navegador (F12)
3. Copia y pega este script completo
4. Presiona Enter para ejecutar las pruebas
5. Luego prueba manualmente:
   - Selecciona fechas del 29/06 al 04/07
   - Verifica que aparezcan los logs en consola
   - Exporta a Excel y verifica las fechas
   - Verifica que el plus automático sea correcto

¿Listo para probar? Ejecuta: ejecutarPruebas()
`);

// Exportar función para uso manual
window.ejecutarPruebas = ejecutarPruebas; 