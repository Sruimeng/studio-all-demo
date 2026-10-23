import argparse
import json
import pathlib
import re
import zipfile
import xml.etree.ElementTree as ET


def convert(path):
    ns = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    with zipfile.ZipFile(path) as archive:
        strings = []
        if 'xl/sharedStrings.xml' in archive.namelist():
            root = ET.fromstring(archive.read('xl/sharedStrings.xml'))
            strings = [''.join(t.text or '' for t in si.findall('.//s:t', ns)) for si in root.findall('s:si', ns)]
        root = ET.fromstring(archive.read('xl/worksheets/sheet1.xml'))
        styles = ET.fromstring(archive.read('xl/styles.xml'))
        fills = styles.find('s:fills', ns)
        formats = styles.find('s:cellXfs', ns)
        rows = {}
        swatches = {}
        for row in root.findall('s:sheetData/s:row', ns):
            number = int(row.get('r'))
            values = {}
            for cell in row.findall('s:c', ns):
                column = re.sub(r'\d', '', cell.get('r'))
                value = cell.find('s:v', ns)
                text = value.text if value is not None else ''.join(t.text or '' for t in cell.findall('.//s:t', ns))
                values[column] = strings[int(text)] if cell.get('t') == 's' and text else text
                if column == 'G':
                    fill = fills[int(formats[int(cell.get('s', '0'))].get('fillId', '0'))]
                    color = fill.find('s:patternFill/s:fgColor', ns)
                    if color is not None and color.get('rgb'):
                        swatches[number] = '#' + color.get('rgb')[-6:].upper()
            rows[number] = values
        for merged in root.findall('s:mergeCells/s:mergeCell', ns):
            match = re.fullmatch(r'([AB])(\d+):\1(\d+)', merged.get('ref'))
            if not match:
                continue
            column, start, end = match.groups()
            for number in range(int(start), int(end) + 1):
                rows.setdefault(number, {})[column] = rows[int(start)][column]

    records = []
    seen = set()
    for number, values in sorted(rows.items()):
        if number == 1 or not values.get('C'):
            continue
        raw_hex = values.get('F', '')
        if not re.fullmatch(r'#?[0-9a-fA-F]{6}', raw_hex.strip()):
            raise ValueError(f'Invalid HEX in F{number}: {raw_hex}')
        if values.get('A') != 'PLA' or not values.get('B') or not values.get('D'):
            raise ValueError(f'Incomplete PLA record in row {number}')
        hex_color = '#' + raw_hex.strip().lstrip('#').upper()
        catalog_id = 'PLA-' + re.sub(r'[^A-Z0-9]+', '-', values['D'].upper()).strip('-')
        if catalog_id in seen:
            raise ValueError(f'Duplicate catalog ID: {catalog_id}')
        seen.add(catalog_id)
        issues = ['sku-not-provided', 'openpbr-missing']
        if swatches.get(number) and swatches[number] != hex_color:
            issues.append('hex-swatch-mismatch')
        records.append({
            'vendor': 'SUNLU', 'sku': '', 'catalogId': catalog_id,
            'product': values['A'], 'colorFamily': values['B'],
            'colorNameCN': values['C'], 'colorNameEN': values['D'],
            'materialType': 'PLA', 'catalogHex': hex_color,
            'pantone': values.get('E') or None, 'd65Lab': None,
            'status': 'color-only', 'issues': issues,
            'source': {
                'spreadsheet': path.name, 'sheet': 'Sheet1', 'row': number,
                'rawHex': raw_hex, 'swatchHex': swatches.get(number),
                'file': None, 'sha256': None, 'materialName': None,
                'colorSpace': 'unknown', 'parameters': {}, 'materialUSDA': None,
            },
        })
    if not records:
        raise ValueError('No PLA colors found')
    return {'version': 1, 'vendor': 'SUNLU', 'records': records}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('spreadsheet', type=pathlib.Path)
    parser.add_argument('--output', type=pathlib.Path, default=pathlib.Path('app/@feature/materials/data/sunlu-pla.json'))
    args = parser.parse_args()
    result = convert(args.spreadsheet)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'records': len(result['records']), 'swatchConflicts': sum('hex-swatch-mismatch' in r['issues'] for r in result['records'])}))
