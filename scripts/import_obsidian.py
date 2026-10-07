"""Obsidian 볼트의 블로그 폴더에서 아직 올리지 않은 글을 가져와 블로그에 추가한다.

- 대상: 블로그 폴더 바로 아래의 .md 중 front matter에 `draft: false`가 있는 노트
- 가져온 노트는 `draft: true`로 바꿔 '업로드 완료'를 표시한다
- 표준 라이브러리만 사용한다 (pip 설치 불필요)

사용법:
    python scripts/import_obsidian.py            # 가져오기
    python scripts/import_obsidian.py --dry-run  # 무엇을 가져올지 미리 보기만
"""

import argparse
import datetime
import json
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
POSTS_DIR = ROOT / 'posts'
ASSETS_DIR = ROOT / 'assets'
MANIFEST = POSTS_DIR / 'posts.json'

DEFAULT_VAULT = Path.home() / 'Documents' / 'Obsidian Vault'
DEFAULT_FOLDER = '50_블로그'

SLUG_RE = re.compile(r'^[a-z0-9]+(?:-[a-z0-9]+)*$')
DATE_RE = re.compile(r'^\d{4}-\d{2}-\d{2}$')
FRONT_MATTER_RE = re.compile(r'^---[ \t]*\n(.*?)\n---[ \t]*(?:\n|$)', re.S)


def unquote(value):
    value = value.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in '"\'':
        return value[1:-1]
    return value


def parse_front_matter(text):
    """Obsidian이 쓰는 단순한 YAML(key: value, [a, b], '- 항목' 목록)만 읽는다."""
    match = FRONT_MATTER_RE.match(text)
    if not match:
        return None, text
    meta = {}
    current_list = None
    for line in match.group(1).split('\n'):
        item = re.match(r'^\s+-\s*(.*)$', line)
        if item and current_list is not None:
            value = unquote(item.group(1))
            if value:
                current_list.append(value)
            continue
        pair = re.match(r'^([\w-]+)\s*:\s*(.*)$', line)
        if not pair:
            continue
        key, raw = pair.group(1), pair.group(2).strip()
        if raw == '':
            meta[key] = []
            current_list = meta[key]
        elif raw.startswith('[') and raw.endswith(']'):
            meta[key] = [unquote(v) for v in raw[1:-1].split(',') if unquote(v)]
            current_list = None
        else:
            meta[key] = unquote(raw)
            current_list = None
    return meta, text[match.end():]


def as_text(value):
    if isinstance(value, list):
        return value[0] if value else ''
    return str(value or '').strip()


def as_list(value):
    if isinstance(value, list):
        return value
    return [value] if value else []


def is_false(value):
    return isinstance(value, str) and value.strip().lower() == 'false'


def find_attachment(vault, name):
    for path in vault.rglob(name):
        if '.obsidian' not in path.parts and path.is_file():
            return path
    return None


def convert_body(body, title, vault, slug, copied):
    """Obsidian 전용 문법을 블로그 마크다운 변환기가 이해하는 형태로 바꾼다."""
    # 본문 첫 줄의 '# 제목'은 블로그가 제목을 따로 보여 주므로 뺀다
    body = body.lstrip('\n')
    first = body.split('\n', 1)
    if first[0].strip() == f'# {title}':
        body = first[1] if len(first) > 1 else ''

    # 코드 블록과 인라인 코드 안의 옵시디언 문법 예시는 바꾸지 않도록 잠시 빼 둔다
    stash = []

    def protect(match):
        stash.append(match.group(0))
        return f'\x00{len(stash) - 1}\x00'

    body = re.sub(r'^ {0,3}(`{3,}|~{3,}).*?\n.*?^ {0,3}\1[ \t]*$', protect, body, flags=re.S | re.M)
    body = re.sub(r'(`+)(?!`).+?(?<!`)\1(?!`)', protect, body)

    # %% 주석 %% 제거
    body = re.sub(r'%%.*?%%', '', body, flags=re.S)

    # ![[그림.png]] / ![[그림.png|300]] → 그림 복사 후 표준 이미지 문법
    def embed(match):
        name = match.group(1).strip()
        if not re.search(r'\.(png|jpe?g|gif|webp|svg|avif)$', name, re.I):
            return name  # 노트 임베드는 이름만 남긴다
        source = find_attachment(vault, Path(name).name)
        if not source:
            print(f'  ! 첨부 파일을 찾지 못했습니다: {name}')
            return f'![{name}]()'
        target_name = f'{slug}-{source.name.replace(" ", "-")}'
        copied.append((source, ASSETS_DIR / target_name))
        return f'![{Path(name).stem}](assets/{target_name})'

    body = re.sub(r'!\[\[([^\]|]+)(?:\|[^\]]*)?\]\]', embed, body)

    # [[노트|별칭]] → 별칭, [[노트#제목]] → 노트
    body = re.sub(r'\[\[([^\]|#]*)(?:#[^\]|]*)?\|([^\]]+)\]\]', r'\2', body)
    body = re.sub(r'\[\[([^\]|#]+)(?:#[^\]]*)?\]\]', r'\1', body)

    # 콜아웃 머리 '> [!note] 제목' → '> **제목**'
    body = re.sub(r'^(>\s*)\[![\w-]+\][+-]?\s*(.*)$',
                  lambda m: f'{m.group(1)}**{m.group(2)}**' if m.group(2) else m.group(1).rstrip(),
                  body, flags=re.M)

    body = re.sub(r'\n{3,}', '\n\n', body)  # 주석을 지운 자리에 남은 빈 줄 정리
    body = re.sub(r'\x00(\d+)\x00', lambda m: stash[int(m.group(1))], body)
    return body.strip() + '\n'


def build_post(meta, body):
    lines = ['---', f'title: {meta["title"]}', f'date: {meta["date"]}']
    if meta['description']:
        lines.append(f'description: {meta["description"]}')
    if meta['tags']:
        lines.append(f'tags: [{", ".join(meta["tags"])}]')
    lines += ['---', '', body]
    return '\n'.join(lines)


def format_manifest(entries):
    # 기존 posts.json과 같은 모양(태그 배열은 한 줄)으로 쓴다
    blocks = []
    for entry in entries:
        fields = []
        for key, value in entry.items():
            if isinstance(value, list):
                rendered = '[' + ', '.join(json.dumps(v, ensure_ascii=False) for v in value) + ']'
            else:
                rendered = json.dumps(value, ensure_ascii=False)
            fields.append(f'    {json.dumps(key)}: {rendered}')
        blocks.append('  {\n' + ',\n'.join(fields) + '\n  }')
    return '[\n' + ',\n'.join(blocks) + '\n]\n'


def mark_uploaded(path, text):
    match = FRONT_MATTER_RE.match(text)
    fm = re.sub(r'^(draft\s*:\s*)false\s*$', r'\1true', match.group(0), count=1, flags=re.M | re.I)
    path.write_text(fm + text[match.end():], encoding='utf-8', newline='\n')


def main():
    parser = argparse.ArgumentParser(description='Obsidian 블로그 폴더에서 새 글을 가져옵니다.')
    parser.add_argument('--vault', type=Path, default=DEFAULT_VAULT, help='Obsidian 볼트 경로')
    parser.add_argument('--folder', default=DEFAULT_FOLDER, help='볼트 안의 블로그 폴더 이름')
    parser.add_argument('--dry-run', action='store_true', help='파일을 바꾸지 않고 결과만 보여 줍니다')
    args = parser.parse_args()

    source_dir = args.vault / args.folder
    if not source_dir.is_dir():
        sys.exit(f'블로그 폴더가 없습니다: {source_dir}')

    manifest = json.loads(MANIFEST.read_text(encoding='utf-8')) if MANIFEST.exists() else []
    imported, skipped, already = [], [], 0

    for note in sorted(source_dir.glob('*.md')):
        text = note.read_text(encoding='utf-8-sig').replace('\r\n', '\n')
        fm, body = parse_front_matter(text)
        if not fm or 'draft' not in fm:
            continue  # 안내 노트처럼 draft 속성이 없으면 블로그 글이 아니다
        if not is_false(fm['draft']):
            already += 1
            continue

        title = as_text(fm.get('title')) or note.stem
        slug = as_text(fm.get('slug')).lower()
        date = as_text(fm.get('date')) or datetime.date.today().isoformat()
        if not SLUG_RE.match(slug):
            skipped.append(f'{note.name}: slug가 비었거나 형식이 맞지 않습니다 (영문 소문자·숫자·하이픈만)')
            continue
        if not DATE_RE.match(date):
            skipped.append(f'{note.name}: date는 YYYY-MM-DD 형식이어야 합니다 ({date})')
            continue

        filename = f'{date}-{slug}.md'
        clash = next((p for p in manifest if p['file'] != filename and re.sub(r'^\d{4}-\d{2}-\d{2}-', '', p['file'][:-3]) == slug), None)
        if clash:
            skipped.append(f'{note.name}: slug "{slug}"를 이미 {clash["file"]}에서 쓰고 있습니다')
            continue

        meta = {
            'title': title,
            'date': date,
            'description': as_text(fm.get('description')),
            'tags': as_list(fm.get('blog_tags')),
        }
        copied = []
        post = build_post(meta, convert_body(body, title, args.vault, slug, copied))
        entry = {'file': filename, 'title': title, 'date': date}
        if meta['description']:
            entry['description'] = meta['description']
        entry['tags'] = meta['tags']

        print(f'+ {note.name} → posts/{filename}')
        if not args.dry_run:
            ASSETS_DIR.mkdir(exist_ok=True)
            for src, dst in copied:
                shutil.copy2(src, dst)
                print(f'  그림 복사: assets/{dst.name}')
            (POSTS_DIR / filename).write_text(post, encoding='utf-8', newline='\n')
            # 같은 파일이 이미 있으면 교체, 없으면 맨 앞에 추가(같은 날짜 글 중 위로)
            manifest = [p for p in manifest if p['file'] != filename]
            manifest.insert(0, entry)
            mark_uploaded(note, text)
        imported.append(note.name)

    if imported and not args.dry_run:
        MANIFEST.write_text(format_manifest(manifest), encoding='utf-8', newline='\n')

    print()
    print(f'가져옴 {len(imported)}개 · 이미 업로드됨 {already}개 · 건너뜀 {len(skipped)}개'
          + (' (미리 보기, 바뀐 파일 없음)' if args.dry_run else ''))
    for reason in skipped:
        print(f'  - {reason}')


if __name__ == '__main__':
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    main()
