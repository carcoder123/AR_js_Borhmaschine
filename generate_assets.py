#!/usr/bin/env python3
"""
Generiert AR.js 3x3 Matrix Barcode-Bilder.
Jede Zelle ist schwarz (1) oder weiß (0).
barcodeValue = bit-pattern als Integer (0-511).
"""

import sys
import math

def generate_barcode_image(value, filename, size=300):
    """Generiert ein 3x3 Matrix Barcode-Bild als SVG."""
    # 3x3 Matrix: 9 Bits
    bits = []
    for i in range(8, -1, -1):
        bits.append((value >> i) & 1)
    
    # Umwandlung in 3x3 Grid (Zeile für Zeile)
    grid = []
    for row in range(3):
        grid_row = bits[row*3:(row+1)*3]
        grid.append(grid_row)
    
    # SVG generieren
    cell_size = size // 3
    padding = 20
    total_size = size + 2 * padding
    
    svg_lines = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{total_size}" height="{total_size + 60}" viewBox="0 0 {total_size} {total_size + 60}">']
    svg_lines.append(f'  <rect width="{total_size}" height="{total_size + 60}" fill="white"/>')
    
    # Barcode-Zellen
    for row in range(3):
        for col in range(3):
            x = padding + col * cell_size
            y = padding + row * cell_size
            if grid[row][col] == 1:
                svg_lines.append(f'  <rect x="{x}" y="{y}" width="{cell_size}" height="{cell_size}" fill="black"/>')
            else:
                svg_lines.append(f'  <rect x="{x}" y="{y}" width="{cell_size}" height="{cell_size}" fill="white" stroke="black" stroke-width="1"/>')
    
    # Wert-Label
    svg_lines.append(f'  <text x="{total_size//2}" y="{size + padding + 30}" font-family="monospace" font-size="18" fill="black" text-anchor="middle">Barcode {value}</text>')
    svg_lines.append('</svg>')
    
    with open(filename, 'w') as f:
        f.write('\n'.join(svg_lines))
    
    print(f'  ✓ {filename} (value={value})')


def generate_qr_code(url, filename, size=300):
    """Generiert einen QR-Code als SVG."""
    # Einfacher QR-Code Generator
    try:
        import qrcode
        qr = qrcode.QRCode(version=1, error_correction=qrcode.constants.ERROR_CORRECT_L)
        qr.add_data(url)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        img.save(filename)
        print(f'  ✓ {filename} (URL: {url})')
    except ImportError:
        print(f'  ⚠ qrcode-Modul nicht verfügbar, erstelle stattdessen Platzhalter für {filename}')
        # Platzhalter SVG
        svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 {size} {size}">
  <rect width="{size}" height="{size}" fill="white"/>
  <text x="{size//2}" y="{size//2}" font-family="monospace" font-size="20" fill="black" text-anchor="middle">QR-Code fÃ¼r:<br/>{url}</text>
</svg>'''
        with open(filename, 'w') as f:
            f.write(svg)
        print(f'  ⚠ Platzhalter erstellt (qrcode-Modul fehlt)')


if __name__ == '__main__':
    import os
    marker_dir = sys.argv[1] if len(sys.argv) > 1 else 'marker'
    os.makedirs(marker_dir, exist_ok=True)
    
    print('Generiere AR.js 3x3 Matrix Barcode-Bilder:')
    for i in range(4):
        filename = os.path.join(marker_dir, f'barcode_{i}.svg')
        generate_barcode_image(i, filename)
    
    print()
    print('Generiere QR-Code:')
    qr_dir = sys.argv[2] if len(sys.argv) > 2 else 'qr'
    os.makedirs(qr_dir, exist_ok=True)
    
    # URL basierend auf GitHub Pages
    url = 'https://carcoder123.github.io/AR_js_Borhmaschine/'
    generate_qr_code(url, os.path.join(qr_dir, 'qr-code.svg'))
