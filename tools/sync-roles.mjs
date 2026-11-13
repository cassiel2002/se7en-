#!/usr/bin/env node
// Copia el rol de cada perfil (users/{uid}.role) al token de Firebase Auth como
// custom claim `role`. Con el claim, las reglas de Firestore no necesitan leer el
// perfil en cada consulta (1 lectura menos por operación).
//
// Uso (desde la carpeta tools/):
//   npm install
//   GOOGLE_APPLICATION_CREDENTIALS=/ruta/fuera/del/repo/clave.json npm run sync-roles -- --dry-run
//   GOOGLE_APPLICATION_CREDENTIALS=/ruta/fuera/del/repo/clave.json npm run sync-roles
//
// Volver a ejecutarlo cada vez que se cree un usuario o cambie un rol.
// Los usuarios ven el cambio al volver a iniciar sesión (o en menos de 1 hora).
// Mientras tanto, las reglas usan el perfil como respaldo, así que no se rompe nada.
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const ROLES_VALIDOS = new Set(['admin', 'cashier']);
const dryRun = process.argv.includes('--dry-run');
const usaEmulador = Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST);

if (!usaEmulador && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('Falta GOOGLE_APPLICATION_CREDENTIALS (ruta al JSON de la cuenta de servicio). Ver tools/README.md');
  process.exit(1);
}

initializeApp(usaEmulador ? { projectId: process.env.GCLOUD_PROJECT || 'demo-se7en' } : { credential: applicationDefault() });

const normalizarRol = (rol) => (rol === 'cajero' ? 'cashier' : rol);

const main = async () => {
  const auth = getAuth();
  const perfiles = await getFirestore().collection('users').get();
  let cambios = 0;
  let errores = 0;

  for (const perfil of perfiles.docs) {
    const uid = perfil.id;
    const rol = normalizarRol(perfil.get('role'));
    if (!ROLES_VALIDOS.has(rol)) {
      console.warn(`- ${uid}: rol desconocido "${perfil.get('role')}", se omite`);
      continue;
    }
    try {
      const usuario = await auth.getUser(uid);
      const actual = usuario.customClaims?.role;
      if (actual === rol) {
        console.log(`= ${usuario.email || uid}: ya tiene role=${rol}`);
        continue;
      }
      console.log(`${dryRun ? '(simulado) ' : ''}* ${usuario.email || uid}: role ${actual ?? '(ninguno)'} -> ${rol}`);
      if (!dryRun) {
        await auth.setCustomUserClaims(uid, { ...(usuario.customClaims || {}), role: rol });
      }
      cambios++;
    } catch (error) {
      errores++;
      const motivo = error?.code === 'auth/user-not-found' ? 'no existe en Authentication' : error?.message;
      console.error(`! ${uid}: ${motivo}`);
    }
  }

  console.log(`\n${cambios} usuario(s) ${dryRun ? 'a actualizar' : 'actualizados'}, ${errores} con error.`);
  process.exit(errores ? 1 : 0);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
