---
name: project-setup
description: Guided setup that brands this Vox kit for its new owner — collects name, logo, colors, and API keys, then applies them. Use when the user says anything like "set up this project", "bu projeyi kur", "make this mine", "configure this", or runs /setup.
---

Do NOT start editing files blindly. Open `SETUP.md` (project root) and follow it
exactly. It is an interview: ask a short list of questions (brand, logo, colors,
and the specific API keys this app needs), then apply the answers to:

- `app.config.ts` — name, tagline, copy, navigation
- `app/globals.css` — brand colors (`--color-primary` / `--color-violet`)
- `app/layout.tsx` — fonts (optional)
- `.env.local` — the API keys you collected
- `public/logo.svg` + `app/icon.svg` — the user's logo (if provided)

Ask **one question at a time**, accept "skip"/"keep default" for any of them, and
never invent API keys. When done, run `npm install` and `npm run dev` and report
the local URL.
