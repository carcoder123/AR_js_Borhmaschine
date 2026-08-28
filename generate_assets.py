#!/usr/bin/env python3
"""
Generiert AR.js 3x3_hamming_6_3 Barcode-Bilder aus dem offiziellen
artoolkit-barcode-markers-collection Repo.

Verwendung:
    python3 generate_assets.py [marker_dir] [qr_dir]
"""

import sys
import os
import urllib.request


def download_barcode(value, filename):
    """Lädt einen Barcode aus dem offiziellen AR.js barcode collection Repo."""
    url = (
        "https://raw.githubusercontent.com/"
        "nicolocarpignoli/artoolkit-barcode-markers-collection/"
        "master/3x3_hamming_6_3/"
        f"{value}.png"
    )
    print(f"  Download {value}.png from {url}")
    urllib.request.urlretrieve(url, filename)
    print(f"  ✓ {filename}")


def generate_qr_code(url, filename, size=300):
    """Generiert einen QR-Code als PNG über die QR Server API."""
    qr_url = (
        f"https://api.qrserver.com/v1/create-qr-code/"
        f"?size={size}x{size}&data={urllib.parse.quote(url)}"
        f"&color=000000&bgcolor=ffffff"
    )
    print(f"  Download QR-Code for {url}")
    urllib.request.urlretrieve(qr_url, filename)
    print(f"  ✓ {filename}")


if __name__ == '__main__':
    marker_dir = sys.argv[1] if len(sys.argv) > 1 else 'marker'
    os.makedirs(marker_dir, exist_ok=True)

    qr_dir = sys.argv[2] if len(sys.argv) > 2 else 'qr'
    os.makedirs(qr_dir, exist_ok=True)

    import urllib.parse

    print('Generiere AR.js 3x3_hamming_6_3 Barcode-Bilder (aus offiziellem Repo):')
    for i in range(4):
        filename = os.path.join(marker_dir, f'barcode_{i}.png')
        download_barcode(i, filename)

    print()
    print('Generiere QR-Code:')
    url = 'https://carcoder123.github.io/AR_js_Borhmaschine/'
    qr_filename = os.path.join(qr_dir, 'qr-code.png')
    generate_qr_code(url, qr_filename)

    print('\nFertig!')
