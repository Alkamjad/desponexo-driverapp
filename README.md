Desponexo DriverApp


Wenn du lokale Änderungen in GitHub sehen willst, nutze diese Schritte:

```bash
git status
git add .
git commit -m "Änderungen speichern"
git push
```

### Tipps für Anfänger

- `git status` zeigt dir immer den aktuellen Stand.
- Wenn `nothing to commit` erscheint, gibt es keine neuen Änderungen.
- Wenn `Everything up-to-date` erscheint, ist GitHub bereits aktuell.

## Branch prüfen

Vor dem Push kannst du den aktiven Branch prüfen:

```bash
git branch
```

Der Stern `*` zeigt den aktiven Branch (z. B. `workplace`).

## Wichtig: Zwei Umgebungen (warum wir manchmal Unterschiedliches sehen)

Es gibt bei uns zwei getrennte Umgebungen:

- **Dein VS Code (Windows, z. B. `E:\Driverapp\Driverapp`)**: Hier ist `origin` mit GitHub verbunden.
- **Meine Agent-Umgebung (`/workspace/Driverapp`)**: Das ist ein separater Container mit eigenem Git-Setup.

Darum kann es sein, dass du `origin/workplace` siehst, ich aber lokal keinen Remote sehe.

### Wenn ich "Änderung fertig" schreibe, bitte bei dir ausführen

```bash
git checkout workplace
git status
git add .
git commit -m "Änderungen von Codex übernehmen"
git push origin workplace
```

Danach siehst du die Änderungen hier:

- `https://github.com/Alkamjad/Driverapp/tree/workplace`
- `https://github.com/Alkamjad/Driverapp/commits/workplace`

## Frontend-ENV (Vercel/Preview/Production)

Lege in deiner Hosting-Plattform folgende Variable an:

- `VITE_FUNCTIONS_BASE_URL` (z. B. `https://desponexodriver.app`)
- `VITE_SUPABASE_URL` (deine Supabase Projekt-URL)
- `VITE_SUPABASE_ANON_KEY` (dein Supabase anon key)
- `ALLOWED_ORIGIN` (für Backend Functions CORS, z. B. `https://dein-projekt.vercel.app`)
- `INTERNAL_FUNCTION_SECRET` (Backend-internes Secret für geschützte interne Function-Calls wie `sendPushNotification`)

Wenn `VITE_FUNCTIONS_BASE_URL` nicht gesetzt ist, nutzt das Frontend automatisch die aktuelle Origin (`window.location.origin`).

