export interface ProductImage {
  id: string;
  url: string;
  alt?: string | null;
  isPrimary: boolean;
}

export interface PublicVariant {
  id: string;
  sku: string;
  size: string;
  color: string;
  colorHex?: string | null;
  available?: number;
  inStock?: boolean;
  status?: string;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  brand: string;
  collection?: string | null;
  shortDescription?: string | null;
  description?: string | null;
  basePrice: number;
  salePrice?: number | null;
  effectivePrice: number;
  saleActive: boolean;
  material?: string | null;
  images: ProductImage[];
  variants: PublicVariant[];
  category?: { slug: string; name: string };
  createdAt: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CartItem {
  id: string;
  variantId: string;
  slug: string;
  name: string;
  sku: string;
  size: string;
  color: string;
  price: number;
  quantity: number;
  lineTotal: number;
  available: number;
  stockIssue: boolean;
  image: string | null;
}

export interface CartView {
  token: string;
  items: CartItem[];
  subtotal: number;
  hasStockIssues: boolean;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
}
