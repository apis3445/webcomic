# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Zinemash — a SvelteKit web app for making short comics/zines in the browser. Users pick a panel layout, drop an image into each panel, drag speech bubbles/captions on top, and type dialogue. Work autosaves; comics can be published to a public URL or printed.

Stack: SvelteKit + **Svelte 5 (runes)**, TypeScript, Konva (via `svelte-konva`) for canvas rendering, Supabase (auth, Postgres, Storage), deployed to Vercel with `@sveltejs/adapter-vercel`. Package manager is **pnpm**.

## Commands

```sh
pnpm dev              # start dev server (vite dev)
pnpm build            # production build
pnpm preview          # preview production build
pnpm check            # svelte-kit sync + svelte-check (type checking)
pnpm check:watch      # type checking in watch mode
pnpm lint             # prettier --check . && eslint .
pnpm format           # prettier --write .
```

There is no test suite. Use `pnpm check` and `pnpm lint` to validate changes.

Database migrations live in `supabase/migrations/` and are applied with `supabase db push` (see `supabase/README.md`). Env vars required: `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_PUBLISHABLE_ID`.

## Architecture

### Editor state — `src/lib/comicState.svelte.ts`

All editor state lives in a single `ComicState` class using Svelte 5 `$state` runes, exported as the singleton `comicState`. It holds the template id, the `panels` array (each with `bgImage`, `bubbles[]`, stage dimensions), active panel/bubble selection, comic id, title, and the current page (`sheetNumber`). Components (editor page, `Panel.svelte`, sidebar controls) all mutate this shared instance — reactivity flows from here, not from props.

Comics can have multiple pages (DB `sheets` rows, one template each). `comicState` holds **one page at a time**; the editor page keeps the other pages in a local `sheetCache` and swaps them through `comicState.loadSheet()`, saving the outgoing page first (`switchPage` in `(main)/comic/+page.svelte`). The save/publish endpoints take a `sheetNumber` in the payload (default 1).

`BUBBLE_FONT` in this file must stay in sync with the Konva `<Text>` font in `src/lib/components/Panel.svelte`: bubble text line-breaking is measured with a canvas 2D context here and rendered by Konva there.

### Templates — `src/lib/templates.ts`

Single source of truth for layouts (`grid-3x3`, `page-1-2-3`, `strip-3`, `vertical-4`, `hero-5`). Adding a template means one entry here **plus** CSS blocks in each grid root that renders it: the editor (`(main)/comic/+page.svelte`), the published view (`comics/[id]/+page.svelte`), the print view, and the picker preview. Template ids double as `slug` values in the `sheet_templates` DB table; `resolveTemplateId()` falls back to inferring by panel count for legacy rows without a slug.

### Rendering

Each panel is a Konva `Stage` (`src/lib/components/Panel.svelte`). Background image, bubbles, tails/cloud shapes, and text are Konva `Path`/`Circle`/`Text` nodes, which provide dragging, z-order, and hit-testing. Bubble `z_index` is persisted server-side.

### Supabase integration

- `src/hooks.server.ts` creates a `@supabase/ssr` server client per request on `event.locals.supabase` (cookie-based auth). All server routes use this client, so **RLS policies apply** — there is no service-role usage.
- Browser client is created in `src/routes/+layout.ts`; session/user flow through `+layout.server.ts` via `locals.safeGetSession`.
- Data model (see `supabase/migrations/20260603_000400_comics_full.sql`): `comics` → `sheets` (numbered pages, FK to `sheet_templates`) → `panels` (by `index`) → `images` and `bubbles`. Bubble visual style (`BubbleType`) is stored in the `bubbles.style` column. Comics are owner-private until `is_public` is set.
- Uploaded panel images and thumbnails go to the `comics` Storage bucket using public URLs.

### Routes

- `(main)/comic` — the editor (the largest page; client-side editor logic plus a server `load` that hydrates `comicState` from DB rows).
- `comics/[id]` — public published view (outside the `(main)` layout group).
- `(main)/browse`, `(main)/comics` — public gallery and the user's own comics.
- `(main)/login`, `(main)/account`, `(main)/auth/*` — Supabase email/OAuth auth flows.
- `src/routes/api/*` — JSON endpoints (Vercel Functions): `upload-image` (creates comic/sheet/panel rows on first upload, uploads to Storage), `comics/[id]/save` (autosave of metadata + bubbles), `comics/[id]/publish`, `comics/[id]/thumbnail`, `my-comics`. All check `auth.getUser()` and ownership before writing; error responses avoid leaking Supabase/Postgres details in prod (see the `saveErrorResponse` pattern in `save/+server.ts`).

### Conventions

- `AGENTS.md` and `GEMINI.md` mirror this file's agent instructions; keep them in sync if you change agent-facing guidance.
- Tabs for indentation, single quotes (Prettier enforced).

---

You are able to use the Svelte MCP server, where you have access to comprehensive Svelte 5 and SvelteKit documentation. Here's how to use the available tools effectively:

## Available Svelte MCP Tools:

### 1. list-sections

Use this FIRST to discover all available documentation sections. Returns a structured list with titles, use_cases, and paths.
When asked about Svelte or SvelteKit topics, ALWAYS use this tool at the start of the chat to find relevant sections.

### 2. get-documentation

Retrieves full documentation content for specific sections. Accepts single or multiple sections.
After calling the list-sections tool, you MUST analyze the returned documentation sections (especially the use_cases field) and then use the get-documentation tool to fetch ALL documentation sections that are relevant for the user's task.

### 3. svelte-autofixer

Analyzes Svelte code and returns issues and suggestions.
You MUST use this tool whenever writing Svelte code before sending it to the user. Keep calling it until no issues or suggestions are returned.

### 4. playground-link

Generates a Svelte Playground link with the provided code.
After completing the code, ask the user if they want a playground link. Only call this tool after user confirmation and NEVER if code was written to files in their project.
