import argparse
import hashlib
import json
import pathlib
import re
import zipfile
import xml.etree.ElementTree as ET


def read_colors(path):
    ns = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    with zipfile.ZipFile(path) as archive:
        strings = []
        if 'xl/sharedStrings.xml' in archive.namelist():
            root = ET.fromstring(archive.read('xl/sharedStrings.xml'))
            strings = [''.join(t.text or '' for t in si.findall('.//s:t', ns)) for si in root.findall('s:si', ns)]
        root = ET.fromstring(archive.read('xl/worksheets/sheet1.xml'))
        rows = []
        for row in root.findall('s:sheetData/s:row', ns):
            values = {}
            for cell in row.findall('s:c', ns):
                value = cell.find('s:v', ns)
                text = value.text if value is not None else ''.join(t.text or '' for t in cell.findall('.//s:t', ns))
                if cell.get('t') == 's' and text:
                    text = strings[int(text)]
                values[re.sub(r'\d', '', cell.get('r'))] = text
            if values.get('A') and values['A'] != 'SKU':
                rows.append((int(row.get('r')), values))
        return rows


def read_materials(path):
    records = {}
    with zipfile.ZipFile(path) as archive:
        for file in sorted(archive.namelist()):
            if not file.endswith('.usda') or file.startswith('__MACOSX/'):
                continue
            content = archive.read(file)
            text = content.decode('utf-8')
            sku = re.search(r'CA\d+', pathlib.PurePosixPath(file).name)
            if not sku or sku.group() in records:
                raise ValueError(f'Ambiguous SKU: {file}')
            if text.count('ND_open_pbr_surface_surfaceshader') != 1 or re.search(r'@[^@]+@|\b(?:references|payload|subLayers)\s*=', text):
                raise ValueError(f'Unsupported material composition: {file}')
            start = text.index('uniform token info:id = "ND_open_pbr_surface_surfaceshader"')
            block = text[start:text.index('token outputs:surface', start)]
            parameters = {}
            for kind, key, value in re.findall(r'^\s*(float|color3f|bool|float3) inputs:(\w+) = ([^\n]+)', block, re.M):
                if kind in ('color3f', 'float3'):
                    parameters[key] = [float(v) for v in value.strip('()').split(',')]
                else:
                    parameters[key] = bool(int(value)) if kind == 'bool' else float(value)
            connections = re.findall(r'inputs:(\w+)\.connect', block)
            if any(key != 'geometry_tangent' for key in connections):
                raise ValueError(f'Unsupported connected input: {file}')
            records[sku.group()] = {
                'file': file, 'sha256': hashlib.sha256(content).hexdigest(),
                'materialName': re.search(r'def Material "([^"]+)"', text).group(1),
                'parameters': parameters, 'materialUSDA': text[text.index('    def Scope "_materials"'):],
            }
    return records


def convert(sheet, materials):
    colors = read_colors(sheet)
    shaders = read_materials(materials)
    records = []
    seen = set()
    for row, values in colors:
        sku = values['A']
        if sku in seen:
            raise ValueError(f'Duplicate SKU: {sku}')
        seen.add(sku)
        source = shaders.get(sku)
        lab = [float(values[key]) for key in ('G', 'H', 'I')]
        issues = []
        if (values['C'] == 'Black' and lab[0] > 50) or ('White' in values['C'] and lab[0] < 70):
            issues.append('lab-conflicts-with-color-name')
        if values['C'] == 'Azure Blue' and values['D'] == '绿色':
            issues.append('color-name-conflict')
        records.append(make_record(sheet.name, row, sku, values, lab, source, issues))
    for sku, source in shaders.items():
        if sku not in seen:
            records.append(make_record(sheet.name, None, sku, {}, None, source, ['sku-not-in-spreadsheet']))
    return {'version': 1, 'vendor': 'Polymaker', 'records': records}


def make_record(sheet, row, sku, values, lab, material, issues):
    if material:
        issues.append('source-color-space-unknown')
        if any(v < 0 or v > 1 for v in material['parameters']['base_color']):
            issues.append('base-color-outside-unit-range')
        if material['materialName'] != sku:
            issues.append('material-name-needs-confirmation')
    else:
        issues.append('openpbr-missing')
    return {
        'vendor': 'Polymaker', 'sku': sku, 'product': values.get('B', ''),
        'colorNameEN': values.get('C', ''), 'colorNameCN': values.get('D', ''),
        'materialType': values.get('J', ''), 'catalogHex': values.get('E'),
        'pantone': values.get('F'), 'd65Lab': lab,
        'status': 'paired' if material and row else 'unmatched' if material else 'color-only',
        'issues': issues,
        'source': {'spreadsheet': sheet, 'row': row, 'colorSpace': 'unknown',
                   'file': None, 'sha256': None, 'materialName': None, 'parameters': {}, 'materialUSDA': None,
                   **(material or {})},
    }


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('spreadsheet', type=pathlib.Path)
    parser.add_argument('archive', type=pathlib.Path)
    parser.add_argument('--output', type=pathlib.Path, default=pathlib.Path('app/@feature/materials/data/polymaker-pla.json'))
    args = parser.parse_args()
    result = convert(args.spreadsheet, args.archive)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'records': len(result['records']), 'paired': sum(r['status'] == 'paired' for r in result['records'])}))
