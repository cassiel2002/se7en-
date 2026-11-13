# Sistema de Puntos - Se7en Barbershop

## 🎯 Configuración para Desarrollo Local

### 1. Configurar Firebase
```bash
# Copiar archivo de configuración
cp .env.local.example .env.local

# Editar .env.local con tus credenciales de Firebase
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Ejecutar en desarrollo
```bash
npm run dev
```

### 4. Inicializar datos de prueba
Una vez que la app esté corriendo, abre la consola del navegador y ejecuta:
```javascript
initDevData()
```

## 🎁 Sistema de Puntos Implementado

### Funcionalidades:
- ✅ **Ganar puntos**: +1 punto por cada corte realizado
- ✅ **Mostrar puntos**: En tarjetas de clientes y perfil
- ✅ **Catálogo de premios**: Gestión completa de premios
- ✅ **Canje de puntos**: Sistema de canje con validaciones
- ✅ **Historial**: Movimientos de puntos ganados/canjeados

### Premios Configurados:
- 🎯 **Corte gratis**: 10 puntos
- 🎨 **Tattoo mínimo**: 20 puntos  
- 🎁 **Perfume**: 25 puntos
- 💰 **50% OFF tattoo**: 30 puntos

### Estructura de Datos:

#### Cliente (extendido)
```typescript
interface Cliente {
  // ... campos existentes
  puntos: number;           // Puntos disponibles
  puntosCanjeados: number;  // Puntos ya utilizados
}
```

#### Nuevas Colecciones:
- `premios` - Catálogo de premios
- `canjes_puntos` - Registro de canjes
- `movimientos_puntos` - Historial de puntos

### Flujo de Usuario:

1. **Cliente realiza corte** → Se registra venta → +1 punto automático
2. **Ver puntos disponibles** → En tarjeta de cliente
3. **Canjear premio** → Validar puntos → Descontar → Generar canje
4. **Usar premio** → Marcar como utilizado en venta

### Páginas Nuevas:
- `/premios` - Gestión de premios (solo admin)
- Componente `PuntosCliente` - Mostrar puntos del cliente

### Permisos:
- **Admin**: Gestión completa de premios y canjes
- **Cajero**: Ver premios, realizar canjes, ver puntos

## 🔧 Próximos Pasos:

1. **Integrar canje en Ventas**: Aplicar descuentos con puntos
2. **Notificaciones**: Avisar cuando cliente puede canjear
3. **Reportes**: Estadísticas de puntos y canjes
4. **Cupones**: Generar códigos para premios canjeados

## 🚀 Comandos Útiles:

```bash
# Desarrollo
npm run dev

# Build para producción
npm run build

# Preview de producción
npm run preview

# Linting
npm run lint
```

## 📱 Responsive:
- ✅ Diseño adaptativo para móviles
- ✅ Touch-friendly para tablets
- ✅ PWA compatible