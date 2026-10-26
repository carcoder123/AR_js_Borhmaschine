# Anleitung für Einsteiger: Grafiken zu Barcodes hinzufügen & ändern

> **Einfacher geht's mit der Config-App:** Unter `config_app/` gibt es eine
> Web-App, mit der sich alles hier Beschriebene per Klick machen lässt
> (neue Barcodes anlegen, Bilder/3D-Modelle hochladen, Farben/Texte
> ändern) – ohne eigene Server, Änderungen werden direkt als Commit nach
> GitHub gepusht. Siehe `config_app/README.md`.
>
> Die folgende manuelle Anleitung bleibt gültig und erklärt, wie es im
> Hintergrund funktioniert.

Diese Anleitung erklärt Schritt für Schritt, wie du in diesem AR-Projekt
Grafiken austauschst und neue Barcodes mit neuen Grafiken anlegst.
Vorkenntnisse sind nicht nötig – es reicht, Dateien öffnen und Text ändern zu können.

---

## 1. Welche Datei ist dafür zuständig?

Es gibt genau **eine Hauptdatei**, in der fast alles steht:

```
index.html
```

Dort ist für **jeden Barcode-Marker** ein Block mit der Grafik definiert.
So sieht so ein Block aus (vereinfacht):

```html
<!-- ============ MARKER 1: EINSCHALTER (Barcode 0) ============ -->
<a-marker type="barcode" value="0" id="marker-onoff" smooth="true" smooth-count="3">
  ...  (3D-Effekte: Rahmen, Ring, Beacon – siehe unten)  ...
  <a-entity position="0 0.82 0">
    <a-box ...></a-box>                        <!-- dunkle Hintergrund-Tafel -->
    <a-plane
      src="images/onoff-instruction.png"        <-- DIE GRAFIK, die am Marker erscheint
      width="0.8"
      height="0.5"
      ...>
    </a-plane>
    <a-text value="Einschalter" ...></a-text>   <-- Der Titel über der Grafik
  </a-entity>
</a-marker>
```

Wichtig zu verstehen:

- **`value="0"`** = die Nummer des Barcodes. Jeder Barcode (0, 1, 2, 3, ...)
  hat seinen eigenen `<a-marker>`-Block.
- **`src="images/onoff-instruction.png"`** = die Bilddatei, die angezeigt wird,
  wenn die Kamera diesen Barcode erkennt.
- Die Barcodes selbst liegen als druckbare Bilder im Ordner `marker/`
  (z. B. `marker/barcode_0.png` für Barcode 0).

Nebenbei gibt es noch `js/ar-instructions.js` – dort stehen nur die
**Texte** (Titel, Erklärung, Schritt-für-Schritt-Liste), die als Overlay
angezeigt werden. Die Grafiken selbst kommen aus der `index.html`.

---

## 2. Grafik eines bestehenden Barcodes austauschen

Das ist der einfachste Fall. Du willst z. B. dem "Einschalter"-Barcode
(Nummer 0) ein neues Bild geben:

**Schritt 1:** Lege dein neues Bild in den Ordner `images/`.
Am besten als PNG-Datei (im Querformat, ca. 1600 x 1000 Pixel).

**Schritt 2:** Öffne `index.html` und suche mit Strg+F nach
`onoff-instruction.png`. Du landest im Block mit `value="0"`.

**Schritt 3:** Ändere den Pfad bei `src="..."` auf deine neue Datei:

```
src="images/mein-neues-bild.png"
```

**Schritt 4:** (Optional) Ändere auch den Titel im `<a-text value="...">`
und die Breite/Höhe (`width`/`height`) – die Werte sind in Metern im
AR-Raum. 0.8 x 0.5 passt zu Bildern im Format 16:10. Bei einem
quadratischen Bild nimmst du z. B. `width="0.6" height="0.6"`.

**Schritt 5:** Testen und hochladen (siehe Abschnitt 5).

**Hinweis für die mitgelieferten SVGs:** Die Bilder im Ordner `images/`
gibt es doppelt – als `.svg` (bearbeitbare Quelle) und `.png` (was im AR
angezeigt wird). Wenn du eine SVG änderst, musst du das PNG neu
erzeugen, sonst sieht man die Änderung nicht:

```bash
cd images
rsvg-convert -w 1600 -h 1000 onoff-instruction.svg -o onoff-instruction.png
```

---

## 3. Einen neuen Barcode mit neuer Grafik hinzufügen

Es gibt 100 vorbereitete Barcodes (Nummern 0–99). Die ersten vier
(0–3) sind schon belegt. Beispiel: Wir fügen Barcode **4** mit einer
"Akku wechseln"-Grafik hinzu.

**Schritt 1 – Barcode-Bild erzeugen:**

```bash
python3 generate_assets.py marker qr
```

Das erzeugt automatisch Bilder für die Barcodes 0 bis 9 im Ordner
`marker/`. Für Barcode 4 nimmst du `marker/barcode_4.png`.

**Schritt 2 – Grafik vorbereiten:**
Lege dein Anleitungsbild (PNG, am besten 1600 x 1000) in den Ordner
`images/`, z. B. `images/battery-instruction.png`.

**Schritt 3 – Marker-Block in `index.html` einfügen:**
Öffne `index.html`, scrolle zum Ende der Marker-Blöcke (direkt unter
dem Block mit `value="3"` und über der Zeile `<!-- Kamera -->`) und
füge dort ein:

```html
<!-- ============ MARKER 5: AKKU (Barcode 4) ============ -->
<a-marker type="barcode" value="4" id="marker-battery" smooth="true" smooth-count="3">
  <a-box
    width="1" height="1" depth="0.004"
    position="0 0 0"
    material="wireframe: true; color: #00ff88; opacity: 0.45; transparent: true"
  ></a-box>
  <a-ring
    position="0 0 0.01"
    radius-inner="0.30"
    radius-outer="0.36"
    segments-theta="64"
    color="#00ff88"
    material="shader: flat; opacity: 0.9; transparent: true; side: double"
    animation="property: scale; from: 1 1 1; to: 1.15 1.15 1.15; dir: alternate; loop: true; dur: 900; easing: easeInOutSine"
  ></a-ring>
  <a-entity
    position="0 0 0.3"
    animation="property: rotation; to: 360 360 0; loop: true; dur: 6000; easing: linear"
    animation__bob="property: position; from: 0 0 0.22; to: 0 0 0.38; dir: alternate; loop: true; dur: 1200; easing: easeInOutSine"
  >
    <a-octahedron
      radius="0.12"
      color="#00ff88"
      material="opacity: 0.85; transparent: true; metalness: 0.2; roughness: 0.4"
    ></a-octahedron>
  </a-entity>
  <a-entity position="0 0.82 0">
    <a-box
      position="0 0 -0.005"
      width="0.84" height="0.54" depth="0.006"
      material="color: #1a1a2e; opacity: 0.92; transparent: true; side: double"
    ></a-box>
    <a-plane
      src="images/battery-instruction.png"
      width="0.8"
      height="0.5"
      position="0 0 0.002"
      material="shader: flat; transparent: true; opacity: 0.97; side: double"
    ></a-plane>
    <a-text
      value="Akku wechseln"
      align="center"
      anchor="center"
      width="1"
      color="#00ff88"
      position="0 0.33 0.005"
    ></a-text>
  </a-entity>
</a-marker>
```

Der einfachste Trick: **Kopiere einen bestehenden Block** (z. B. den mit
`value="3"`) und ändere nur drei Stellen:
1. `value="3"` → `value="4"`  (die Barcode-Nummer!)
2. `src="images/guard-instruction.png"` → dein neues Bild
3. `value="Sägeguide"` im `<a-text>` → dein neuer Titel
4. (Saubere Arbeit:) `id="marker-guard"` → `id="marker-battery"` und den Kommentar darüber anpassen

**Der drei Teile in jedem Marker-Block, die du frei anpassen kannst:**

| Teil | Was es macht | Anpassen? |
|------|--------------|-----------|
| `<a-box wireframe>` | grüner Rahmen um den Marker | Farbe (`color: #00ff88`) |
| `<a-ring>` + `<a-octahedron>` | pulsierender Ring + schwebender 3D-Kristall | Größe/Position/Farbe |
| `<a-entity position="0 0.82 0">` | die Anleitungstafel (Bild + Titel) | Bild (`src`), Größe, Titel, Höhe (0.82 = wie weit über dem Marker) |

**Schritt 4 – Texte in `js/ar-instructions.js` eintragen:**
Öffne `js/ar-instructions.js`. Im `instructions`-Objekt kommt eine neue
Nummer dazu – wichtig: die Nummer muss exakt zur `value`-Nummer im
HTML passen:

```js
'4': {
  title: 'Akku wechseln',
  text: 'Der Akku sitzt am Handgriff. Zum Entnehmen den Entriegelungsknopf drücken.',
  steps: [
    'Entriegelungsknopf an der Unterseite des Handgriffs drücken',
    'Akku nach hinten aus der Führung ziehen',
    'Neuen Akku einsetzen, bis er einrastet'
  ]
},
```

(Fehlt dieser Eintrag, erscheint beim Scannen kein Text-Overlay –
die 3D-Grafik am Marker funktioniert trotzdem.)

**Schritt 5 – Barcode drucken und aufkleben:**
`marker/barcode_4.png` ausdrucken (mindestens 5 x 5 cm, nicht
reflektierend) und auf die Bohrmaschine kleben.

---

## 4. Wo hängt was an welchem Barcode? (Übersicht)

| Barcode (`value`) | Marker-Block in index.html | Grafik | Barcode-Bild |
|-------------------|----------------------------|--------|--------------|
| 0 | MARKER 1: EINSCHALTER | `images/onoff-instruction.png` | `marker/barcode_0.png` |
| 1 | MARKER 2: BOHRFUTTER | `images/chuck-instruction.png` | `marker/barcode_1.png` |
| 2 | MARKER 3: DREHZAHLREGELER | `images/speed-instruction.png` | `marker/barcode_2.png` |
| 3 | MARKER 4: SÄGEGUARD | `images/guard-instruction.png` | `marker/barcode_3.png` |

Die Zuordnung läuft **immer über die Nummer**: Das Bild `marker/barcode_N.png`
wird gedruckt und aufgeklebt, und im HTML fängt der Block mit
`value="N"` genau diesen Barcode ein.

---

## 5. Testen & Veröffentlichen

**Lokal testen** (Kamera braucht `https://` oder `localhost`, geht also
nur am PC-Browser mit Webcam):

```bash
cd /home/juli/Dokumente/AR_js
python3 -m http.server 8080
# dann im Browser: http://localhost:8080
```

**Auf GitHub Pages veröffentlichen** (damit es aufs Handy geht):

```bash
cd /home/juli/Dokumente/AR_js
git add .
git commit -m "Neuer Marker: Akku wechseln"
git push origin main
```

Nach ca. 1–2 Minuten ist die Änderung unter
https://carcoder123.github.io/AR_js_Borhmaschine/ live.
Der QR-Code (`qr/qr-code.png`) zeigt bereits auf diese URL und muss
nur bei einem URL-Wechsel neu erzeugt werden.

**Wichtig: Browser-Cache.** Wenn du etwas geändert hast, aber am Handy
noch das Alte siehst: Seite im Browser neu laden (oder den Tab schließen
und die Seite über den QR-Code neu öffnen).

---

## 6. Häufige Fehler

| Problem | Ursache / Lösung |
|---------|------------------|
| Marker wird erkannt, aber Bild fehlt | Pfad in `src="..."` falsch (Groß-/Kleinschreibung beachten!) oder Bild nicht in `images/` |
| Marker wird gar nicht erkannt | `value` im HTML stimmt nicht mit der Barcode-Nummer überein; oder Marker zu klein/aufgeklebt gedruckt |
| Kein Text-Overlay erscheint | Eintrag in `js/ar-instructions.js` fehlt oder die Nummer passt nicht |
| Bild wird angezeigt, aber alte Version | PNG nicht neu erzeugt (bei geänderten SVGs, siehe Abschnitt 2) oder Browser-Cache |
| Kamera startet nicht | Die Seite muss über HTTPS (GitHub Pages) oder `localhost` geladen werden |
