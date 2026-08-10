'use strict';

/* Smoke check del cliente Angular: el build debe servir la app nueva y conservar
   los invariantes de privacidad que antes cubría el test DOM del cliente vanilla. */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'src/app/app.component.html'), 'utf8');
const round = fs.readFileSync(path.join(root, 'src/app/round/round.component.html'), 'utf8');
const service = fs.readFileSync(path.join(root, 'src/app/game.service.ts'), 'utf8');
const index = fs.readFileSync(path.join(root, 'dist/el-impostor/browser/index.html'), 'utf8');
let fails = 0;
const check = (label, ok) => { console.log(`${ok ? '✅' : '❌'} ${label}`); if (!ok) fails++; };

check('index servido por Angular', index.includes('<impostor-root>') && !index.includes('/app.js'));
check('la palabra solo se muestra al rol player', round.includes("game.role()?.role === 'impostor'") && round.includes('game.role()?.word'));
check('el estado de roles vive en señales Angular', service.includes("readonly role = signal<RolePayload | null>(null)"));
check('la reconexión se centraliza en un único intento', service.includes('private reconnecting = false') && service.includes('rejoinOnce()'));
check('la interfaz no usa innerHTML', !html.includes('innerHTML'));

console.log(fails === 0 ? '\n✅ TODO OK' : `\n❌ ${fails} fallos`);
process.exit(fails === 0 ? 0 : 1);
