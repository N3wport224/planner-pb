# Habit Game

Mobile-first website for the **HABIT GAME** Google Sheet. Tick habits and tasks, log mood and
sleep, and watch your character level up – on any device. Your data stays in your own Google
Sheet; this site only talks to it through a private Apps Script link.

**Try it without setup:** open the site → Settings → *Try the demo*.

## Connect your sheet (one time)

1. In your HABIT GAME Google Sheet: **Extensions → Apps Script**. Replace `Code.gs` with the
   whole `HabitGame_AllInOne.gs` script, save, reload the sheet, then run
   **Habit Game → Set up checkboxes** and allow the permissions.
2. Menu **🌐 Website → Create website key**.
3. In Apps Script: **Deploy → New deployment → Web app** · Execute as **Me** ·
   Who has access **Anyone** → Deploy. Copy the web app URL (ends in `/exec`).
4. On each device: open the site → ⚙️ Settings → paste the URL and the key.
   On a phone, **Share → Add to Home Screen** for an app-like icon.

The URL and key are stored only in that device's browser. Anyone with both could change your
tracker, so keep them private; *Create website key* again to sign out every device.
After editing the Apps Script code, use **Deploy → Manage deployments → Edit → New version**.

## Hosting

Static files, no build step: `index.html`, `styles.css`, `app.js`, `demo.js`. GitHub Pages:
Settings → Pages → Deploy from a branch → `main` / root.
