# Bohrmaschine – AR Anleitung

Virtuelle AR-Anleitung für eine Bohrmaschine, die per Smartphone-Browser über Barcode-Marker gesteuert wird.

## Funktionsweise

1. **Barcode-Marker** werden an verschiedenen Stellen der Bohrmaschine angebracht (ausgedruckt und aufgeklebt)
2. Ein **QR-Code** führt zum Hosting der AR-Seite (z.B. GitHub Pages)
3. Beim Scannen des QR-Codes öffnet sich die AR-Seite im Smartphone-Browser
4. Die Kamera erkennt die Barcode-Marker und zeigt **AR-Anleitungen** direkt im Kamerabild

## Projektstruktur

```
AR_js/
├── index.html              # Hauptdatei – AR-Szene mit Barcode-Markern
├── css/
│   └── style.css           # Stylesheet
├── js/
│   └── ar-instructions.js  # AR-Logik: Marker-Erkennung & Anzeigen
├── images/                 # Anleitungsbilder (SVG)
│   ├── onoff-instruction.svg   # Einschalter-Anleitung
│   ├── chuck-instruction.svg   # Bohrfutter-Anleitung
│   ├── speed-instruction.svg   # Drehzahlregler-Anleitung
│   └── guard-instruction.svg   # Sägeguide-Anleitung
├── marker/                 # Barcode-Bilder zum Ausdrucken (3x3 Hamming 6/3)
│   ├── barcode_0.png       # Einschalter (Barcode 0)
│   ├── barcode_1.png       # Bohrfutter (Barcode 1)
│   ├── barcode_2.png       # Drehzahlregler (Barcode 2)
│   └── barcode_3.png       # Sägeguide (Barcode 3)
├── lib/
│   └── aframe-ar.js        # AR.js-Bundle (lokal, kein CDN nötig)
├── qr/
│   └── qr-code.png         # QR-Code zum Öffnen der AR-Seite
└── generate_assets.py      # Script zum Generieren neuer Barcode-Bilder
```

## Marker-Übersicht

| Barcode | Position auf Bohrmaschine | Funktion |
|---------|--------------------------|----------|
| 0 | Einschalter | Ein-/Ausschalten |
| 1 | Bohrfutter | Bohrer spannen |
| 2 | Drehzahlregler | Geschwindigkeit einstellen |
| 3 | Sägeguide | Bohrtiefe einstellen |

## Lokaler Test

```bash
# Einfacher HTTP-Server im Projektverzeichnis
cd AR_js
python3 -m http.server 8080

# Dann im Browser öffnen:
# http://localhost:8080
```
Achtung: Kamera-Zugriff gibt es nur über `https://` oder `http://localhost`.
Der Test mit der Handy-Kamera muss also über die GitHub-Pages-URL (HTTPS) erfolgen.

## Deployment auf GitHub Pages

Repository: https://github.com/carcoder123/AR_js_Borhmaschine
Live-URL:   https://carcoder123.github.io/AR_js_Borhmaschine/

### 1. Neue Version veröffentlichen
```bash
cd /home/juli/Dokumente/AR_js
git add .
git commit -m "Beschreibung der Änderung"
git push origin main
```
GitHub Pages baut automatisch neu (Quelle: Branch `main`, Ordner `/root`).

### 2. GitHub Pages aktivieren (falls deaktiviert)
1. Repository auf GitHub öffnen: https://github.com/carcoder123/AR_js_Borhmaschine
2. Settings → Pages
3. Source: "Deploy from a branch"
4. Branch: main / root
5. Save
Status auch per CLI prüfbar: `gh api /repos/carcoder123/AR_js_Borhmaschine/pages`

### 3. QR-Code prüfen
Der QR-Code in `qr/qr-code.png` zeigt bereits auf die Live-URL. Nur bei URL-Wechsel neu generieren:
```bash
python3 generate_assets.py marker qr
```

## Barcode-Marker drucken

Die Barcode-Bilder in `marker/` können einfach ausgedruckt werden:

- **Größe:** Mindestens 5x5 cm (größer = bessere Erkennung)
- **Papier:** Hochglanz oder matt, kein reflektierendes Material
- **Aufkleben:** Flach auf der Bohrmaschine anbringen, nicht geknickt

### Neue Barcode-Marker generieren

```bash
python3 generate_assets.py marker qr
```

Erzeugt Barcodes aus dem offiziellen [artoolkit-barcode-markers-collection](https://github.com/nicolocarpignoli/artoolkit-barcode-markers-collection) Repo (3x3_hamming_6_3 Format). Wichtig: Die generierten Marker nur mit `matrixCodeType: 3x3_HAMMING63` in `index.html` verwenden.

## Technische Details

- **AR.js** (https://github.com/AR-js-org/AR.js) – Marker-Erkennung im Browser (Bundle lokal in `lib/aframe-ar.js`)
- **A-Frame** (https://aframe.io) – 3D-Rendering für AR-Elemente (CDN, Version 1.6.0)
- **Barcode-Detection** – AR.js 3x3 Hamming 6/3 Matrix-Code (Werte 0–511, hier 0–3)
  - `<a-marker type="barcode" value="N">` – die Nummer steht im `value`-Attribut,
    `src` wird bei Barcode-Markern ignoriert!
  - `arjs="... detectionMode: mono_and_matrix; matrixCodeType: 3x3_HAMMING63; ..."`
    – muss zu dem Marker-Format passen (Ordner `3x3_hamming_6_3` der Collection)
- **WebRTC** – Kamera-Zugriff (HTTPS erforderlich, auch im LAN-Test!)

## Browser-Unterstützung

- Chrome/Android (empfohlen)
- Safari/iOS (ab iOS 11)
- Firefox/Android
- Edge (Chromium-basiert)

## Anpassung

### Eigene Anleitungstexte
In `js/ar-instructions.js` die `instructions`-Objekte bearbeiten.

### Eigene Anleitungsbilder
SVG-Dateien in `images/` ersetzen.

### Weitere Marker
1. Neuen Barcode generieren: `python3 generate_assets.py marker qr`
2. In `index.html` neuen `<a-marker>` hinzufügen
3. In `js/ar-instructions.js` Anweisung hinzufügen

## Lizenz

MIT
