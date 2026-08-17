const WP_URL = import.meta.env.WP_API_URL ?? 'http://localhost:8881/wp-json/wp/v2';

export interface WPRendered {
  rendered: string;
}

export interface WPMedia {
  source_url: string;
  alt_text: string;
  media_details?: { width?: number; height?: number };
}

export interface Producto {
  id: number;
  slug: string;
  title: WPRendered;
  content: WPRendered;
  featured_media: number;
  meta: {
    descripcion_corta: string;
    beneficios: string; // JSON string -> string[]
    tabla_nutricional: string; // JSON string -> {nutriente, cantidad, vd}[]
    ingredientes: string; // JSON string -> string[]
    presentaciones: string; // JSON string -> {gramaje, ean}[]
    modo_preparacion: string;
    faq: string; // JSON string -> {pregunta, respuesta}[]
  };
  _embedded?: {
    'wp:featuredmedia'?: WPMedia[];
  };
}

interface HasFeaturedMedia {
  _embedded?: { 'wp:featuredmedia'?: WPMedia[] };
}

/** Extrae la imagen destacada embebida (_embed), o null si no tiene una. */
export function getFeaturedImage(item: HasFeaturedMedia): WPMedia | null {
  return item._embedded?.['wp:featuredmedia']?.[0] ?? null;
}

export interface Servicio {
  id: number;
  slug: string;
  title: WPRendered;
  content: WPRendered;
  featured_media: number;
  _embedded?: {
    'wp:featuredmedia'?: WPMedia[];
  };
}

export interface Page {
  id: number;
  slug: string;
  title: WPRendered;
  content: WPRendered;
  excerpt: WPRendered;
  featured_media: number;
  _embedded?: {
    'wp:featuredmedia'?: WPMedia[];
  };
}

/**
 * El origen falla intermitentemente para requests que vienen desde la
 * infraestructura de build de Cloudflare (funciona siempre desde otras
 * IPs) — reintenta antes de fallar el build entero por eso.
 *
 * Además: varias páginas piden el mismo listado (ej. catálogo y ficha
 * de producto llaman a getProductos() cada una) — sin caché, cada una
 * dispara su propia request en paralelo. Se cachea por path: una sola
 * request real por build, todas las llamadas que sigan la reciben
 * servida.
 */
const cache = new Map<string, Promise<unknown>>();

async function wpFetchSinCache<T>(path: string, intentos = 12): Promise<T> {
  for (let intento = 1; intento <= intentos; intento++) {
    try {
      const res = await fetch(`${WP_URL}${path}`);
      if (!res.ok) {
        throw new Error(`WP REST ${path} -> ${res.status}`);
      }
      return (await res.json()) as T;
    } catch (err) {
      if (intento === intentos) {
        throw new Error(`WP REST ${path} falló tras ${intentos} intentos: ${err}`);
      }
      // Los cortes vistos en producción duraron ~13s seguidos: con
      // menos margen los reintentos se agotaban dentro del mismo corte.
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  throw new Error('inalcanzable');
}

function wpFetch<T>(path: string): Promise<T> {
  if (!cache.has(path)) {
    cache.set(
      path,
      wpFetchSinCache<T>(path).catch((err) => {
        cache.delete(path);
        throw err;
      })
    );
  }
  return cache.get(path) as Promise<T>;
}

export function getProductos() {
  return wpFetch<Producto[]>('/productos?per_page=100&_embed');
}

export function getProductoBySlug(slug: string) {
  return wpFetch<Producto[]>(`/productos?slug=${slug}&_embed`).then((r) => r[0]);
}

export function getServicios() {
  return wpFetch<Servicio[]>('/servicios?per_page=100&_embed');
}

export function getPages() {
  return wpFetch<Page[]>('/pages?per_page=100&_embed');
}

export function getPageBySlug(slug: string) {
  return wpFetch<Page[]>(`/pages?slug=${slug}&_embed`).then((r) => r[0]);
}

/** Los campos repeater se guardan como JSON en meta; esto los tipa de vuelta. */
export function parseJsonMeta<T>(value: string | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
