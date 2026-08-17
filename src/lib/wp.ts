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

async function wpFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${WP_URL}${path}`);
  if (!res.ok) {
    throw new Error(`WP REST ${path} -> ${res.status}`);
  }
  return res.json() as Promise<T>;
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
