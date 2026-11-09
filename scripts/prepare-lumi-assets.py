"""Deterministic extraction of the approved Lumi sheet. Requires Pillow.

Run from the frontend root after placing the cleaned sheet in the reference
folder. A single scale and explicit head anchors prevent pose-size jumps.
The sprites are not animation frames.
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'public/assets/lumi'
sheet = Image.open(DEST / 'reference/lumi-clean-sheet.png').convert('RGBA')
assert sheet.size == (1536, 1024), 'Review anchors before using a different sheet.'
poses = [('idle', 0, 0, 270), ('greeting', 1, 0, 750), ('question', 2, 0, 1240),
         ('analyzing', 0, 1, 240), ('alert', 1, 1, 740), ('success', 2, 1, 1240)]
for name, col, row, head_x in poses:
    tile = sheet.crop((col * 512, row * 512, (col + 1) * 512, (row + 1) * 512))
    # The sheet has alpha but retains a translucent background-removal fringe.
    # Suppress that low-opacity residue, preserving antialiasing at the edge.
    tile.putalpha(tile.getchannel('A').point(lambda a: max(0, min(255, round((a - 150) * 255 / 90)))))
    canvas = Image.new('RGBA', (480, 520))
    # The lower row starts its lightning ~24 px higher within each source tile.
    canvas.alpha_composite(tile, (240 - (head_x - col * 512), 8 if row == 0 else 32))
    canvas.save(DEST / f'lumi-{name}.png', optimize=True)

# A dedicated head asset, with padding around the entire lightning bolt.
idle = Image.open(DEST / 'lumi-idle.png')
head = idle.crop((72, 16, 408, 336))
head.thumbnail((304, 304), Image.Resampling.LANCZOS)
icon = Image.new('RGBA', (320, 320))
icon.alpha_composite(head, ((320 - head.width) // 2, (320 - head.height) // 2))
icon.save(DEST / 'lumi-head.png', optimize=True)
print('Created 6 normalized RGBA poses (480x520) and head (320x320).')
