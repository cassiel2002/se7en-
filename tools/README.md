# Herramientas de administración

Scripts que se ejecutan **desde tu PC**, no desde el hosting. Usan el Admin SDK de
Firebase, que tiene acceso total al proyecto, así que la clave nunca debe subirse
al repositorio ni a Hostinger.

## Requisitos (una sola vez)

1. Node.js 22 o superior.
2. Firebase Console → ⚙️ Configuración del proyecto → **Cuentas de servicio** →
   **Generar nueva clave privada**. Se descarga un archivo JSON.
3. Guardalo **fuera de la carpeta del proyecto** (por ejemplo `~/claves/se7en-admin.json`).
   Quien tenga ese archivo puede leer y borrar toda la base: tratalo como una contraseña.
4. En esta carpeta:
   ```bash
   npm install
   ```

## `sync-roles`: roles en el token (custom claims)

Copia el rol de cada perfil (`users/{uid}.role`) al token del usuario. Con esto las
reglas de Firestore dejan de leer el perfil en cada consulta.

```bash
# Ver qué cambiaría, sin aplicar nada
GOOGLE_APPLICATION_CREDENTIALS=~/claves/se7en-admin.json npm run sync-roles -- --dry-run

# Aplicar
GOOGLE_APPLICATION_CREDENTIALS=~/claves/se7en-admin.json npm run sync-roles
```

En Windows (PowerShell):

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\claves\se7en-admin.json"; npm run sync-roles
```

Volvé a ejecutarlo cada vez que crees un usuario o cambies un rol. Los usuarios toman
el rol nuevo al volver a iniciar sesión (o en menos de una hora). Mientras tanto las
reglas usan el perfil como respaldo.

Para **quitarle el acceso a alguien**, deshabilitá su cuenta en Firebase Console →
Authentication (borrar solo el perfil no alcanza si su token conserva el rol).
