// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

import vercel from '@astrojs/vercel';

// https://astro.build/config
export default defineConfig({
  site: 'https://peruanita.com',
  output: 'static',
  integrations: [sitemap()],

  vite: {
    plugins: [tailwindcss()],
  },

  adapter: vercel(),

  /*
    Los redirects de vercel.json no se estaban aplicando: el adaptador
    de Vercel genera su propio config de rutas y no los mezcla. Estos sí
    funcionan porque Astro los resuelve a través del propio adaptador.
    URLs viejas de la WordPress anterior que cambiaron de estructura.
  */
  redirects: {
    '/producto-para-programas-sociales': '/programas-sociales/',
    '/producto-para-programas-sociales/': '/programas-sociales/',
    '/trabajo': '/trabaja-con-nosotros/',
    '/trabajo/': '/trabaja-con-nosotros/',
    '/productos-comerciales/harina-de-maca-2': '/productos-comerciales/harina-de-maca/',
    '/productos-comerciales/harina-de-maca-2/': '/productos-comerciales/harina-de-maca/',
    '/productos-comerciales/harina-de-quinua-2': '/productos-comerciales/harina-de-quinua/',
    '/productos-comerciales/harina-de-quinua-2/': '/productos-comerciales/harina-de-quinua/',
    '/maintenance': '/',
    '/maintenance/': '/',
  },
});