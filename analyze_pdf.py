import pdfplumber

with pdfplumber.open(r'C:\Users\Jordan\Documents\workspace\EduardoFerreira\public\Curriculo-Eduardo-Ferreira-2026.pdf') as pdf:
    for i, page in enumerate(pdf.pages):
        print(f'=== PAGE {i+1} ===')
        print(f'Width: {page.width}, Height: {page.height}')
        chars = page.chars
        for c in chars[:200]:
            x = c["x0"]
            y = c["top"]
            size = c["size"]
            font = c["fontname"]
            text = repr(c["text"])
            print(f'  x={x:.1f} y={y:.1f} size={size:.1f} font={font} text={text}')
        print('...')
        print('Lines:', page.lines[:10])
        print('Rects:', page.rects[:10])