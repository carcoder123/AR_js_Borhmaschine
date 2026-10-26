# AR.js Config-App

Web-App zum Verwalten der AR-Anleitung – **ohne eigenen Server**. Die App
ist eine statische Seite (läuft auf GitHub Pages unter `/config_app/` oder
lokal per `python3 -m http.server`) und pusht Änderungen direkt per
GitHub-API als Commits ins Repository. GitHub Pages baut danach
automatisch neu.

## Was die App kann

- **Maschinen verwalten** – mehrere Maschinen ("Top-Level") pro Repo, jede mit
  eigener Marker-Liste und QR-Code. Die AR-Seite wählt per URL:
  `index.html` = erste Maschine, `index.html?machine=<id>` = bestimmte Maschine.
  Konfiguration: `config/machines.json` (Registry + globale Kamera-Einstellungen)
  und `config/machines/<id>.json` (Marker pro Maschine).
- **Barcode-Marker verwalten** – Anlegen (freie Werte 0–7), Bearbeiten, Löschen
- **Barcode-Bilder erzeugen** – offline im Browser, pixelidentisch zur
  offiziellen artoolkit-Collection (3x3 Hamming 6/3), Upload + Download als PNG
- **Anleitungsbilder hinterlegen** – Datei auswählen oder neu hochladen
  (`images/`), Größe/Position/Hintergrund konfigurieren
- **3D-Modelle hinterlegen** – `.glb` hochladen (`3d_models/`), Position,
  Skalierung, Drehgeschwindigkeit
- **Deko konfigurieren** – Wireframe-Rahmen, pulsierender Ring, 3D-Beacon
  (Form, Größe, Animationszeiten), Marker-Farbe, Glättung
- **Anleitungstexte** – Titel, Text und Schritt-für-Schritt-Liste pro Marker
- **Globale Einstellungen** – Kamera-Auflösung, Erkennungsmodus, Barcode-Typ,
  Overlay-Verhalten, QR-Code-URL (QR-Code wird im Browser neu generiert)
- **Live-Vorschau** – schematische 3D-Vorschau des Markers ohne AR-Kamera

Alles landet in **einem Commit** pro „Speichern & Pushen“
(`config/markers.json` + neue Dateien). Tastenkürzel: Strg+S.

## Wichtig: Format-Grenze

Der Barcode-Typ `3x3_HAMMING63` hat physikalisch genau **8 gültige Codes
(Werte 0–7)**. 0–4 sind belegt, 5–7 sind frei. Wer mehr Marker braucht,
muss auf `3x3` (64 Werte) umstellen – dann sind aber **alle** Barcode-Bilder
neu zu erzeugen und auszudrucken.

## Wichtig: nicht per Doppelklick öffnen (Firefox)

Die App muss über eine `http(s)://`-Adresse laufen – entweder GitHub Pages
oder lokal per `python3 -m http.server 8080` im Projektordner und dann
`http://localhost:8080/config_app/`. Wird die Datei per Doppelklick
(`file://`) geöffnet, blockiert Firefox alle GitHub-API-Aufrufe
(„NetworkError when attempting to fetch resource“). Chromium ist da
toleranter, sauber ist nur die http-Variante.

## Einrichtung (einmalig)

1. GitHub-Token erstellen: GitHub → Settings → Developer settings →
   **Fine-grained tokens** → Generate new token
   - Repository access: **only** `AR_js_Borhmaschine`
   - Permissions: **Contents → Read and write**
   - Ablaufdatum nach Wunsch (z. B. 90 Tage)
2. Config-App öffnen (lokal: `python3 -m http.server 8080` im Projektordner,
   dann `http://localhost:8080/config_app/`; oder live auf GitHub Pages)
3. „Globale Einstellungen“ → GitHub-Zugang: Token eintragen → „Verbindung testen“
4. Der Token wird nur im localStorage dieses Browsers gespeichert – er wird
   nie ins Repository geschrieben oder an andere Stellen übertragen.

## Ablauf nach dem Speichern

1. Die App committet nach GitHub (Branch `main`)
2. GitHub Pages baut in ca. 1–2 Minuten neu
3. Die AR-Seite lädt `config/markers.json` immer ohne Cache – Änderungen
   sind nach dem Pages-Rebuild sofort sichtbar (ggf. Seite neu laden)
4. Lokal: `git pull`, um den Stand zu übernehmen

## Dateien

```
config_app/
├── index.html        # App-UI
├── css/app.css
├── js/app.js         # UI-Logik, Formulare, Vorschau
├── js/barcodes.js    # Barcode-Generator (8 Muster, offline)
├── js/gh.js          # GitHub-API (Lesen + Commit über Git-Data-API)
└── lib/qrcode.js     # QR-Generator (MIT, Kazuhiko Arase)
```
