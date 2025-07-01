# 🚀 Guía de Despliegue - Se7en Barbershop

## 📋 Configuración para kioskito.click/se7en

### ✅ Cambios Realizados

La aplicación ha sido configurada para funcionar correctamente en **kioskito.click/se7en**:

1. **Base Path**: Configurado en `vite.config.ts` como `/se7en/`
2. **Router**: React Router configurado con `basename="/se7en/"`
3. **Assets**: Todas las rutas de imágenes actualizadas
4. **Meta Tags**: SEO optimizado para el nuevo dominio

### 🛠️ Comandos de Build

```bash
# Instalar dependencias
npm install

# Build para producción
npm run build

# Vista previa del build
npm run preview
```

### 📁 Estructura de Archivos para Deploy

```
dist/
├── index.html
├── manifest.json          ← Nuevo: Configuración PWA
├── sw.js                  ← Nuevo: Service Worker
├── assets/
│   ├── index-[hash].js
│   ├── index-[hash].css
│   └── logo-se7en.jpeg
└── se7en/
    └── logo-se7en.jpeg
```

### 🔧 Archivos PWA Importantes

**manifest.json**: Configuración para instalación como app nativa
**sw.js**: Service Worker para funcionamiento offline
**.htaccess**: Redirecciones para SPA (debe estar en la carpeta se7en)

### 🌐 Configuración del Servidor Web

#### Para Apache (.htaccess):
```apache
RewriteEngine On
RewriteRule ^se7en/(.*)$ /se7en/index.html [L]
```

#### Para Nginx:
```nginx
location /se7en {
    try_files $uri $uri/ /se7en/index.html;
}
```

### 🔒 Variables de Entorno

La aplicación está configurada con:
- **Base URL**: `https://kioskito.click/se7en/`
- **Environment**: Production
- **Firebase**: Mantiene la configuración existente

### 📱 Características Mobile-Ready

✅ **Responsive Design** - Adaptable a cualquier dispositivo
✅ **Touch Optimized** - Botones táctiles optimizados
✅ **Progressive Web App (PWA)** - Se puede instalar como app nativa
✅ **iOS Safari Compatible** - Funciona perfectamente en iPhone
✅ **Offline Support** - Service Worker para funcionamiento básico offline
✅ **App-like Experience** - Pantalla completa, sin barras del navegador
✅ **Install Prompt** - Notificación inteligente para instalar

### 🔧 Configuración Firebase

La configuración de Firebase se mantiene intacta. Asegúrate de:

1. Agregar `kioskito.click` a los dominios autorizados en Firebase Console
2. Verificar que las reglas de Firestore permitan el acceso desde el nuevo dominio

### 🚀 Deploy Steps

1. **Build del proyecto**:
   ```bash
   npm run build
   ```

2. **Subir archivos**: Subir todo el contenido de la carpeta `dist/` al directorio `/se7en/` en el servidor

3. **Configurar redirects**: Asegurar que el servidor redirige todas las rutas SPA correctamente

4. **Verificar SSL**: Confirmar que HTTPS esté habilitado en kioskito.click

### ✅ Testing Checklist

**Funcionalidad Básica:**
- [ ] Login funciona correctamente
- [ ] Navegación entre páginas
- [ ] Sidebar móvil funciona
- [ ] Imágenes se cargan correctamente
- [ ] Firebase conecta sin errores
- [ ] Rutas SPA redirigen apropiadamente

**PWA y Mobile:**
- [ ] Manifest.json se carga correctamente
- [ ] Service Worker se registra sin errores
- [ ] Prompt de instalación aparece en dispositivos compatibles
- [ ] App funciona offline básicamente
- [ ] Botón de logout accesible en móviles
- [ ] Safe area respetada en dispositivos con notch
- [ ] Error boundaries funcionan correctamente

### 📞 Soporte

Para cualquier problema durante el despliegue, verificar:
1. Configuración del servidor web
2. Dominios autorizados en Firebase
3. Rutas de assets correctas

---
**Sistema desarrollado para Se7en Barbershop**
*Powered by Sistema Kioskito* 