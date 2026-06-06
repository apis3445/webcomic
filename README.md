# Zinemash

Zinemash is a web app for making short comics and zines in the browser. You pick a layout (a classic 3×3 grid or a 1 + 2 + 3 page), drop an image into each panel, then drag speech bubbles, thought clouds, caption boxes, and bursts on top and type the dialogue. Everything autosaves as you work, and when you're done you can publish the comic to a public URL to share — or print it straight to letter‑size paper.

## How it's built

- **SvelteKit + Svelte 5 (runes)** — the editor is a single SvelteKit app. Comic state lives in a `$state` class (`src/lib/comicState.svelte.ts`) so panels and bubbles stay reactive across the canvas and the sidebar.
- **TypeScript** end‑to‑end, with `svelte-check` for type safety.
- **Konva via `svelte-konva`** — each panel is a Konva `Stage`. The background image, speech bubbles, and the tail/cloud shapes are all rendered as `Path`/`Circle`/`Text` nodes, which makes dragging, z‑order, and hit‑testing free.
- **Supabase** — `@supabase/ssr` for auth (email + OAuth), Postgres for comic/panel/bubble rows, and Storage for uploaded panel images and thumbnails. Server routes use `event.locals.supabase` so RLS applies.
- **Vercel** — deployed with `@sveltejs/adapter-vercel`. Image uploads, comic CRUD, save, and publish all run as Vercel Functions under `src/routes/api/*`.
- **pnpm** for installs, **ESLint + Prettier** for lint/format.

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```sh
# create a new project
npx sv create my-app
```

To recreate this project with the same configuration:

```sh
# recreate this project
pnpm dlx sv@0.15.3 create --template minimal --types ts --add prettier eslint mcp="ide:claude-code,gemini,vscode+setup:remote" --install pnpm comic
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.
