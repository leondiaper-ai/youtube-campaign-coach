"""Keep previously shared Station URLs pointing at the integrated deck section."""
from pathlib import Path
R=Path(__file__).resolve().parents[1]
(R/'public/vaccines/station.html').write_text('''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url=/vaccines#station"><title>The Vaccines Station</title></head><body><p>The Station proposal is now part of the campaign deck. <a href="/vaccines#station">Open The Vaccines Station</a>.</p></body></html>''')
print('Station compatibility page points to /vaccines#station')
