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
├── marker/                 # Barcode-Bilder für AR.js (3x3 Matrix)
│   ├── barcode_0.svg       # Einschalter (Barcode 0)
│   ├── barcode_1.svg       # Bohrfutter (Barcode 1)
│   ├── barcode_2.svg       # Drehzahlregler (Barcode 2)
│   └── barcode_3.svg       # Sägeguide (Barcode 3)
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

## Deployment auf GitHub Pages

### 1. GitHub Repository erstellen
```bash
# Neues Repository auf github.com erstellen (z.B. "AR_js")
# Dann:
cd /home/juli/Dokumente
git init AR_js
cd AR_js
git add .
git commit -m "Initial AR-Anleitung Projekt"
git branch -M main
git remote add origin https://github.com/JULI_USERNAME/AR_js.git
git push -u origin main
```

### 2. GitHub Pages aktivieren
1. Repository auf GitHub öffnen
2. Settings → Pages
3. Source: "Deploy from a branch"
4. Branch: main / root
5. Save

### 3. QR-Code aktualisieren
Nachdem die Seite live ist, die URL aktualisieren:
```bash
# Neue URL im QR-Code generieren (z.B. https://juli.github.io/AR_js/)
cd qr
curl -sL "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=NEUE_URL&color=000000&bgcolor=ffffff" -o qr-code.png
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

Erzeugt Barcodes aus dem offiziellen [artoolkit-barcode-markers-collection](https://github.com/nicolocarpignoli/artoolkit-barcode-markers-collection) Repo (3x3_hamming_6_3 Format).

## Technische Details

- **AR.js** (https://github.com/AR-js-org/AR.js) – Marker-Erkennung im Browser
- **A-Frame** (https://aframe.io) – 3D-Rendering für AR-Elemente
- **Barcode-Detection** – AR.js 3x3 Matrix Barcode (Werte 0-511)
- **WebRTC** – Kamera-Zugriff (HTTPS erforderlich für Produktion)

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
