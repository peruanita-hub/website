/**
 * Comprueba que el subrayado se dibuja en todas las páginas, tanto al
 * cargar directo como al navegar con ClientRouter.
 *
 * Lo dibuja rough-notation dentro de una isla de React, midiendo el
 * texto en el navegador. Por eso la comprobación no se conforma con que
 * el SVG exista: mide la longitud real de sus trazos, que es lo que
 * distingue un subrayado dibujado de uno de ancho cero —el modo en que
 * fallaba al navegar entre páginas—.
 *
 * Uso:  node tests/subrayado.test.mjs
 *       MOTOR=webkit BASE=http://localhost:4322 node tests/subrayado.test.mjs
 */
import { chromium, webkit, firefox } from 'playwright';

const MOTOR = { chromium, webkit, firefox }[process.env.MOTOR ?? 'chromium'];
const BASE = process.env.BASE ?? 'http://localhost:4321';

function medir(page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('svg.rough-annotation')).map((svg) => {
      const paths = Array.from(svg.querySelectorAll('path'));
      // El texto anotado es el hermano anterior al SVG.
      const texto = svg.previousElementSibling;
      return {
        texto: (texto?.textContent || '').trim().slice(0, 32),
        largo: Math.round(paths.reduce((n, p) => n + (p.getTotalLength?.() ?? 0), 0)),
      };
    })
  );
}

async function revisar(page, etiqueta) {
  await page.waitForTimeout(1600);
  // Recorre la página por si algún trazo espera a entrar en pantalla.
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 400) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 50));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(1000);

  const filas = await medir(page);
  const rotos = filas.filter((f) => f.largo === 0);
  const ruta = new URL(page.url()).pathname;
  console.log(`\n### ${etiqueta} [${ruta}] — ${filas.length} trazos, ${rotos.length} vacíos`);
  filas.forEach((f) =>
    console.log(`   ${f.largo > 0 ? 'OK   ' : 'VACIO'} ${String(f.largo).padStart(5)}  "${f.texto}"`)
  );
  if (filas.length === 0) console.log('   SIN NINGÚN TRAZO');
  return rotos.length + (filas.length === 0 ? 1 : 0);
}

const browser = await MOTOR.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errores = [];
page.on('pageerror', (e) => errores.push(e.message));

let fallos = 0;

console.log('===== CARGA DIRECTA =====');
for (const ruta of ['/', '/la-empresa/', '/servicios/', '/programas-sociales/', '/productos-comerciales/']) {
  await page.goto(BASE + ruta, { waitUntil: 'networkidle' });
  fallos += await revisar(page, 'carga directa');
}

console.log('\n===== NAVEGACIÓN =====');
await page.goto(BASE + '/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);

await page.click('nav#nav-principal a[href="/la-empresa/"]');
fallos += await revisar(page, 'menú → la empresa');

await page.click('nav#nav-principal a[href="/servicios/"]');
fallos += await revisar(page, 'menú → servicios');

await page.hover('nav#nav-principal [data-submenu]');
await page.waitForTimeout(350);
await page.click('nav#nav-principal [data-submenu] a[href="/productos-comerciales/"]');
fallos += await revisar(page, 'desplegable → catálogo');

// Tarjeta del catálogo, no el enlace al propio catálogo del desplegable.
await page.click('main a[href^="/productos-comerciales/"]:not([href$="-comerciales/"])');
fallos += await revisar(page, 'catálogo → ficha');

await page.click('nav[aria-label="Migas de pan"] a[href="/productos-comerciales/"]');
fallos += await revisar(page, 'migas → catálogo');

await page.goBack();
fallos += await revisar(page, 'atrás del navegador');

await page.goForward();
fallos += await revisar(page, 'adelante del navegador');

if (errores.length) {
  console.log('\n=== ERRORES DE PÁGINA ===');
  errores.forEach((e) => console.log('  ', e));
}

console.log(`\n${fallos === 0 ? 'CORRECTO' : 'FALLA'}: ${fallos} trazos sin dibujar`);
await browser.close();
process.exit(fallos === 0 && errores.length === 0 ? 0 : 1);
