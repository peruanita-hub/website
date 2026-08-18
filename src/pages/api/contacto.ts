/**
 * Recibe los formularios de Distribuidores y Postulación, y los reenvía
 * por correo con Resend.
 *
 * Variables de entorno requeridas (Vercel → Settings → Environment Variables):
 *   RESEND_API_KEY   clave de API de Resend
 *   CONTACTO_DESTINO destino (por defecto comercial@peruanita.com)
 *   CONTACTO_REMITE  remitente verificado en Resend
 *
 * Sin RESEND_API_KEY el endpoint responde 503: falla de forma visible en
 * vez de tragarse silenciosamente las solicitudes de clientes.
 */
import type { APIRoute } from 'astro';

export const prerender = false;

/**
 * Los campos replican los del formulario de Ninja Forms que tenía el
 * sitio anterior, incluidos sus adjuntos.
 */
const CAMPOS: Record<
  string,
  { titulo: string; campos: [string, string][]; adjuntos: [string, string][] }
> = {
  distribuidores: {
    titulo: 'Nueva solicitud de distribución',
    campos: [
      ['razon_social', 'Nombre y/o Razón Social'],
      ['ruc', 'Número de RUC'],
      ['email', 'Correo de contacto'],
      ['productos', 'Productos solicitados'],
    ],
    adjuntos: [
      ['vigencia_poder', 'Vigencia de poder'],
      ['rnp', 'RNP vigente'],
    ],
  },
  postulacion: {
    titulo: 'Nueva postulación de desarrollo profesional',
    campos: [
      ['nombre', 'Nombres completos'],
      ['edad', 'Edad'],
      ['email', 'Email'],
      ['profesion', 'Profesión'],
      ['disponibilidad', 'Disponibilidad'],
    ],
    adjuntos: [['cv', 'CV']],
  },
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function redirigir(url: URL, estado: 'ok' | 'error'): Response {
  const destino = new URL(url.pathname === '/api/contacto' ? '/' : url.pathname, url.origin);
  destino.searchParams.set('envio', estado);
  return Response.redirect(destino.toString(), 303);
}

export const POST: APIRoute = async ({ request }) => {
  const url = new URL(request.url);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return new Response('Formulario inválido', { status: 400 });
  }

  // Honeypot: si viene relleno, es un bot. Responde 200 para no darle señal.
  if (form.get('website')) {
    return redirigir(url, 'ok');
  }

  const tipo = String(form.get('formulario') ?? '');
  const definicion = CAMPOS[tipo];
  if (!definicion) {
    return new Response('Formulario desconocido', { status: 400 });
  }

  const RESEND_API_KEY = import.meta.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    return new Response('El envío de correo no está configurado en este entorno.', { status: 503 });
  }

  const filas = definicion.campos
    .map(([nombre, etiqueta]) => {
      const valor = String(form.get(nombre) ?? '').trim();
      return `<tr><td><strong>${escapeHtml(etiqueta)}</strong></td><td>${escapeHtml(valor)}</td></tr>`;
    })
    .join('');

  const adjuntos: { filename: string; content: string }[] = [];
  const adjuntados: string[] = [];

  for (const [nombre, etiqueta] of definicion.adjuntos) {
    const archivo = form.get(nombre);
    if (!(archivo instanceof File) || archivo.size === 0) continue;

    // Resend espera el contenido en base64.
    const bytes = new Uint8Array(await archivo.arrayBuffer());
    let binario = '';
    for (const byte of bytes) binario += String.fromCharCode(byte);

    adjuntos.push({ filename: archivo.name, content: btoa(binario) });
    adjuntados.push(`${etiqueta}: ${archivo.name}`);
  }

  const listaAdjuntos = adjuntados.length
    ? `<p><strong>Adjuntos</strong><br>${adjuntados.map(escapeHtml).join('<br>')}</p>`
    : '';

  const respuesta = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: import.meta.env.CONTACTO_REMITE ?? 'web@peruanita.com',
      to: import.meta.env.CONTACTO_DESTINO ?? 'comercial@peruanita.com',
      reply_to: String(form.get('email') ?? '') || undefined,
      subject: definicion.titulo,
      html: `<h2>${escapeHtml(definicion.titulo)}</h2><table>${filas}</table>${listaAdjuntos}`,
      ...(adjuntos.length > 0 && { attachments: adjuntos }),
    }),
  });

  if (!respuesta.ok) {
    return redirigir(url, 'error');
  }

  return redirigir(url, 'ok');
};
