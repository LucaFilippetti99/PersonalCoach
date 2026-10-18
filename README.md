# PersonalCoach

A personal coach for **training and nutrition**: Claude designs workout programs and meal plans, and a **local web app** displays them and lets me log sessions, body measurements, groceries and fridge contents. No database and no cloud: all data lives in plain **JSON and Markdown files** in this folder, read and written by both Claude and the web app.

## How it works

```
        Claude (Cowork)                         web app (React + Vite)
   designs programs, meal plans   ──►  JSON /   ◄──  logs sessions, measurements,
   analyzes progress and plateaus      Markdown       groceries, fridge, manual edits
                                       files
```

- **Claude** follows the rules in [`ISTRUZIONI.md`](ISTRUZIONI.md): it reads the profile, the current program and the logs, updates the data while respecting the schema, and replies in a direct, practical way.
- **The web app** (in [`webapp/`](webapp/)) reads and writes the same files through a small local API, and refreshes itself when Claude changes the data.

## What's inside

| Path | Contents |
|---|---|
| `ISTRUZIONI.md` | Coach instructions and behavior rules |
| `profilo.md` | Personal data, goals, constraints and preferences |
| `impostazioni.json` | Weekly schedule, kcal/protein targets, target weight |
| `schede/` | Current training program |
| `log/` | Workout history and measurements (weight, waist) |
| `piani-pasti/` | Weekly meal plans (`YYYY-Www.json`) |
| `spesa.json`, `frigo.json` | Shopping list and fridge/pantry inventory |
| `skills/piano-pasti-settimanale/` | Claude skill that builds the meal plan from the shopping list and fridge |
| `webapp/` | React + Vite web app (see [`webapp/README.md`](webapp/README.md)) |

## Web app features

- **Home**: today's workout, the week at a glance, today's meals, progress
- **Training**: program, history with Hevy import, per-exercise progress, muscle map, day and session editor
- **Food**: meal plan, shopping list (tick an item → it moves to the fridge), fridge with expiry dates
- **Health**: weight and waist with a 7-day moving average, settings
- **Claude**: forms that generate ready-to-paste text for the coach chat

## Quick start

Requires Node.js 20.19 or newer (`nvm use` reads `webapp/.nvmrc`).

```bash
cd webapp
npm install      # first time only
npm run dev      # http://localhost:5173
```

Other commands: `npm run dev:rete` (reachable from your phone on the same Wi-Fi), `npm start` (build + server on `:4173`), `npm test` (Vitest). Technical details are in [`webapp/ARCHITETTURA.md`](webapp/ARCHITETTURA.md).

## Using it with Claude

1. Open this folder as a project in Claude (Cowork): the instructions in `ISTRUZIONI.md` guide the coach.
2. Ask for a program, a weekly meal plan, or report a session: Claude updates the files.
3. Open the web app to browse and edit everything; changes from both sides stay in sync.

## Notes

- Files in `log/`, `schede/` and `piani-pasti/` must remain **valid JSON** and follow the schema described in `webapp/ARCHITETTURA.md`.
- This folder contains personal data (profile, measurements, habits), so keep the repository **private**.
