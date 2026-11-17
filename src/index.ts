/**
 * tapa-gr: client for the public read API of tapa.gr.
 * Docs: https://tapa.gr/developers/  ·  OpenAPI: https://tapa.gr/openapi.json
 * Read endpoints are free and need no key, account or authentication (60 requests/minute per IP).
 */

export const BASE_URL = 'https://tapa.gr';
export const OPENAPI_URL = 'https://tapa.gr/openapi.json';
export const DOCS_URL = 'https://tapa.gr/developers/';
/** MCP server (Streamable HTTP, read-only tools: search_pages, get_page_markdown, get_pricing, get_contact). */
export const MCP_URL = 'https://tapa.gr/mcp';
export const MCP_SERVER_CARD_URL = 'https://tapa.gr/mcp/server-card';
export const A2A_URL = 'https://tapa.gr/a2a';

export interface SearchResult { title: string; url: string; md?: string; description?: string }
export interface SearchResults { query: string; results: SearchResult[]; limit: number; total: number; next_cursor: string | null }
export interface PageMarkdown { url: string; md?: string; markdown: string; truncated?: boolean }
export interface SitePackage {
  id: string; name: string; priceNet: number; renewalPerYearNet: number; pages?: string; deliveryWorkingDays?: number;
  recommended?: boolean; includedEmails?: number; domainIncluded?: boolean; supportHoursIncluded?: number;
  firstYearHostingIncluded?: boolean; renewal?: string; features?: string[];
}
export interface SupportPack { id: string; name?: string; hours: number; ratePerHourNet?: number; priceNet: number; availabilityLimited?: boolean }
/** All prices are net in EUR (+ VAT 24%). */
export interface Pricing {
  currency: 'EUR'; vat?: { rate?: number; note?: string }; sitePackages: SitePackage[]; sitePackagePayment?: string;
  extras?: Record<string, Record<string, unknown>>; supportPacks: SupportPack[];
  supportTerms?: { validityDays?: number; changeRequestsWithinWorkingDays?: number; payment?: string; url?: string };
  pricingPage?: string; noEshop?: string;
}
export interface Contact {
  name?: string; email: string; phone: string; whatsapp?: { number?: string; url?: string }; address?: string;
  contactPage?: string; quoteRequestForm: string; freeAudit?: string; languages?: string[]; areaServed?: string; note?: string;
}
export interface Health { status: 'pass' | 'fail' | 'warn'; serviceId?: string; description?: string; checks?: Record<string, { status: string; time?: string }[]> }

/** Error returned by the API ({"error":{"code","message"}}), with the HTTP status. */
export class TapaApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryAfter?: number;
  constructor(status: number, code: string, message: string, retryAfter?: number) {
    super(message);
    this.name = 'TapaApiError';
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

export interface ClientOptions {
  /** Defaults to https://tapa.gr */
  baseUrl?: string;
  /** Custom fetch (defaults to globalThis.fetch). */
  fetch?: typeof fetch;
  /** Extra request headers, e.g. a User-Agent for your agent. */
  headers?: Record<string, string>;
}

export interface SearchOptions { limit?: number; cursor?: string }

export class TapaClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly headers: Record<string, string>;

  constructor(options: ClientOptions = {}) {
    this.baseUrl = (options.baseUrl || BASE_URL).replace(/\/+$/, '');
    const f = options.fetch || (globalThis as { fetch?: typeof fetch }).fetch;
    if (!f) throw new Error('No fetch implementation available (Node 18+ or pass options.fetch).');
    this.fetchImpl = f;
    this.headers = { accept: 'application/json', ...(options.headers || {}) };
  }

  private async get<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
    const url = new URL(this.baseUrl + path);
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
    const res = await this.fetchImpl(url.toString(), { method: 'GET', headers: this.headers });
    const body = await res.json().catch(() => null) as unknown;
    if (!res.ok) {
      const e = (body as { error?: { code?: string; message?: string } } | null)?.error;
      const ra = res.headers.get('retry-after');
      throw new TapaApiError(res.status, e?.code || 'http_' + res.status, e?.message || res.statusText || 'Request failed', ra ? Number(ra) : undefined);
    }
    return body as T;
  }

  /** Search public tapa.gr pages (Greek or English keywords). One page of results; use next_cursor for more. */
  searchPages(q: string, options: SearchOptions = {}): Promise<SearchResults> {
    return this.get<SearchResults>('/api/agent/search', { q, limit: options.limit, cursor: options.cursor });
  }

  /** Iterate over every matching page, following next_cursor. */
  async *searchAll(q: string, options: { limit?: number } = {}): AsyncGenerator<SearchResult> {
    let cursor: string | undefined;
    do {
      const page = await this.searchPages(q, { limit: options.limit ?? 20, cursor });
      for (const r of page.results) yield r;
      cursor = page.next_cursor ?? undefined;
    } while (cursor);
  }

  /** Read one tapa.gr page as Markdown, by path (e.g. "/about/") or full https://tapa.gr/ URL. */
  getPageMarkdown(path: string): Promise<PageMarkdown> {
    return this.get<PageMarkdown>('/api/agent/page', { path });
  }

  /** Website packages, renewals, extras and support packs (net EUR, + VAT 24%). */
  getPricing(): Promise<Pricing> {
    return this.get<Pricing>('/api/agent/pricing');
  }

  /** Email, phone, WhatsApp, address and the quote request form URL. */
  getContact(): Promise<Contact> {
    return this.get<Contact>('/api/agent/contact');
  }

  /** Health of the public API (application/health+json). */
  getHealth(): Promise<Health> {
    return this.get<Health>('/api/health');
  }
}

/** Shared default client for https://tapa.gr */
export const tapa = new TapaClient();
export default TapaClient;
