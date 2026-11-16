import argparse
import hashlib
import json
import pathlib
import re


def material_type(product):
    name = product.upper()
    if name.startswith('RPETG'):
        return 'PETG'
    for base in ('PETG', 'PEBA', 'HIPS', 'TPU', 'TPE', 'PLA', 'ABS', 'ASA', 'PPS', 'PET', 'PA', 'PC', 'PVA'):
        if name.startswith(base):
            return base
    return 'Unknown'


def digest(value, length):
    return hashlib.sha256(value.encode('utf-8')).hexdigest()[:length]


def convert(path):
    raw = path.read_bytes()
    html = raw.decode('utf-8-sig')
    match = re.search(r'\bconst\s+COLORS\s*=\s*(\[.*?\])\s*;', html, re.S)
    if not match:
        raise ValueError('COLORS JSON array not found')
    colors = json.loads(match.group(1))
    if not isinstance(colors, list):
        raise ValueError('COLORS must be an array')
    sha256 = hashlib.sha256(raw).hexdigest()
    records = []
    seen = set()
    products = set()
    for index, color in enumerate(colors):
        hex_color = color.get('hex', '')
        if not isinstance(hex_color, str) or not re.fullmatch(r'#[0-9a-fA-F]{6}', hex_color):
            raise ValueError(f'Invalid HEX at color {index}')
        hex_color = hex_color.upper()
        relationships = color.get('records')
        if not isinstance(relationships, list) or not relationships:
            raise ValueError(f'Missing product records at color {index}')
        declared = color.get('products')
        if not isinstance(declared, list) or set(declared) != {item.get('p') for item in relationships}:
            raise ValueError(f'Product relationships disagree at color {index}')
        pantone = color.get('pantone') or None
        if pantone is not None and not isinstance(pantone, str):
            raise ValueError(f'Invalid Pantone at color {index}')
        for relationship in relationships:
            product, cn, en = (relationship.get(key) for key in ('p', 'cn', 'en'))
            if not isinstance(product, str) or not product.strip():
                raise ValueError(f'Missing product at color {index}')
            if not isinstance(cn, str) or not isinstance(en, str) or not (cn.strip() or en.strip()):
                raise ValueError(f'Incomplete product name at color {index}')
            identity = json.dumps([product, cn, en, hex_color], ensure_ascii=False, separators=(',', ':'))
            catalog_id = f'color-{digest(product, 12)}-{digest(identity, 20)}'
            if catalog_id in seen:
                raise ValueError(f'Duplicate product/name/HEX: {identity}')
            seen.add(catalog_id)
            products.add(product)
            records.append({
                'vendor': 'eSUN', 'sku': '', 'catalogId': catalog_id,
                'product': product, 'colorFamily': color.get('category') or None,
                'colorNameCN': cn, 'colorNameEN': en,
                'materialType': material_type(product), 'catalogHex': hex_color,
                'pantone': pantone, 'd65Lab': None,
                'status': 'color-only', 'issues': ['sku-not-provided', 'openpbr-missing'],
                'source': {
                    'spreadsheet': '产品颜色管理.html', 'row': None,
                    'rawHex': color['hex'], 'file': None, 'sha256': sha256,
                    'materialName': None, 'colorSpace': 'unknown',
                    'parameters': {}, 'materialUSDA': None,
                },
            })
    counts = (len(colors), len(records), len(products))
    if counts != (621, 670, 65):
        raise ValueError(f'Expected 621 colors / 670 records / 65 products; got {counts}')
    records.sort(key=lambda record: record['catalogId'])
    return {'version': 1, 'vendor': 'eSUN', 'records': records}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('html', type=pathlib.Path)
    parser.add_argument('output', nargs='?', type=pathlib.Path, default=pathlib.Path('app/@feature/materials/data/esun-colors.json'))
    args = parser.parse_args()
    result = convert(args.html)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'records': len(result['records']), 'products': len({record['product'] for record in result['records']}), 'sha256': result['records'][0]['source']['sha256']}))
