# tapa-gr

Small TypeScript / ESM client for the public read API of [tapa.gr](https://tapa.gr/), a Greek web-design studio.

- Docs: <https://tapa.gr/developers/>
- OpenAPI 3.1: <https://tapa.gr/openapi.json>
- MCP server (Streamable HTTP, read-only tools): `https://tapa.gr/mcp`

Read endpoints are free and need no key, account or authentication. Limit: 60 requests per minute per IP (HTTP 429 with `Retry-After` above that). Site content is mostly Greek; prices are net EUR, + VAT 24%.

## Install

Not on npm yet. Install from GitHub:

```sh
npm install github:mikemorakis/tapa-gr-sdk
```

Requires Node 18+ (or any runtime with `fetch`).

## Usage

```ts
import { TapaClient, MCP_URL } from 'tapa-gr';

const tapa = new TapaClient({ headers: { 'user-agent': 'my-agent/1.0' } });

// Search pages (one page of results, cursor pagination)
const first = await tapa.searchPages('ιστοσελίδα για ιατρούς', { limit: 5 });
console.log(first.total, first.results.map((r) => r.url));
if (first.next_cursor) {
  const second = await tapa.searchPages('ιστοσελίδα για ιατρούς', { limit: 5, cursor: first.next_cursor });
}

// Or iterate over every match
for await (const page of tapa.searchAll('seo')) console.log(page.title);

// Read a page as Markdown
const about = await tapa.getPageMarkdown('/about/');

// Pricing and contact details
const pricing = await tapa.getPricing();   // sitePackages, supportPacks, extras (net EUR)
const contact = await tapa.getContact();   // email, phone, WhatsApp, quoteRequestForm URL

console.log(MCP_URL); // https://tapa.gr/mcp
```

Errors from the API throw `TapaApiError` with `status`, `code` and, for 429, `retryAfter` (seconds).

## What this client does not do

The API is read-only for agents. Quote and contact requests are sent by a person through the forms on tapa.gr, which are protected by Cloudflare Turnstile, so this package has no method to submit them. Use `getContact()` to get the quote form URL and the contact details instead. The forms' endpoint accepts an `Idempotency-Key` header (see the OpenAPI document).

## API reference

| Method | Endpoint | Returns |
| --- | --- | --- |
| `searchPages(q, { limit?, cursor? })` | `GET /api/agent/search` | `SearchResults` (`results`, `total`, `next_cursor`) |
| `searchAll(q, { limit? })` | follows `next_cursor` | async iterator of `SearchResult` |
| `getPageMarkdown(path)` | `GET /api/agent/page` | `PageMarkdown` |
| `getPricing()` | `GET /api/agent/pricing` | `Pricing` |
| `getContact()` | `GET /api/agent/contact` | `Contact` |
| `getHealth()` | `GET /api/health` | `Health` |

Exported constants: `BASE_URL`, `OPENAPI_URL`, `DOCS_URL`, `MCP_URL`, `MCP_SERVER_CARD_URL`, `A2A_URL`.

## License

MIT
