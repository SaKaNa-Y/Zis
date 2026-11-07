#!/usr/bin/env python3
"""Inventory evolution records, render situation navigation, and check its inputs."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import tempfile

BLOCK = re.compile(r'^```evolution-situation[ \t]*\r?\n(.*?)^```[ \t]*(?:\r?\n|$)', re.M | re.S)
ID = re.compile(r'^sit-[a-z0-9]+(?:-[a-z0-9]+)*$')
DISPOSITIONS = {'unread', 'no-candidate', 'linked', 'unresolved'}
OUTPUTS = {'index.md', 'screening.json', 'reviews.json'}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def encode(value):
    return json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(',', ':')).encode()


def read_json(path, default=None):
    if not path.exists() and default is not None:
        return default
    return json.loads(path.read_text(encoding='utf-8'))


def primary_paths(root):
    return sorted(set(root.glob('skills/*/*/record.md')) | set(root.glob('discussions/*/record.md')))


def safe_file(root, value):
    if not isinstance(value, str) or not value or '\\' in value:
        raise ValueError('expected a relative file path')
    p = Path(value)
    if p.is_absolute() or '..' in p.parts:
        raise ValueError('path must remain inside the history root')
    target = root / p
    target.resolve().relative_to(root.resolve())
    current = root
    for part in p.parts:
        current = current / part
        if current.is_symlink():
            raise ValueError('history symlinks are unsupported')
    if not target.is_file():
        raise ValueError('file is missing')
    return target


def source_hash(path):
    data = path.read_bytes()
    # A primary record can own a situation referring to its historical body.
    if path.name == 'record.md':
        data = BLOCK.sub('', data.decode('utf-8')).encode('utf-8')
    return digest(data)


def inventory(root):
    manifest = read_json(root / 'manifest.json')
    paths = primary_paths(root)
    actual = {str(p.relative_to(root)) for p in paths}
    declared = {r['path'] for r in manifest['records']}
    return {'version': 1, 'records': {str(p.relative_to(root)): source_hash(
        safe_file(root, str(p.relative_to(root)))) for p in paths},
        'unregistered': sorted(actual - declared), 'missing': sorted(declared - actual)}


def require_text(value, label):
    if not isinstance(value, str) or not value.strip():
        raise ValueError(label + ' must be nonempty text')


def collect(root):
    found, errors = {}, []
    for path in primary_paths(root):
        rel = str(path.relative_to(root))
        try:
            text = safe_file(root, rel).read_text(encoding='utf-8')
            blocks = list(BLOCK.finditer(text))
            if len(blocks) != len(re.findall(r'^```evolution-situation\b', text, re.M)):
                raise ValueError('unclosed situation block')
            for block in blocks:
                item = json.loads(block.group(1))
                if not isinstance(item, dict) or item.get('version') != 1:
                    raise ValueError('unsupported situation version')
                sid = item.get('id', '')
                if not isinstance(sid, str) or not ID.fullmatch(sid) or sid in found:
                    raise ValueError('invalid or duplicate situation id')
                for field in ('situation', 'interpretation', 'revisit'):
                    require_text(item.get(field), field)
                applies = item.get('applicability')
                if not isinstance(applies, dict):
                    raise ValueError('applicability must be an object')
                for field in ('when', 'exclude'):
                    require_text(applies.get(field), 'applicability.' + field)
                for field in ('skills', 'search_terms'):
                    if not isinstance(item.get(field), list) or not item[field]:
                        raise ValueError(field + ' must be a nonempty list')
                    for value in item[field]:
                        require_text(value, field)
                for skill in item['skills']:
                    if not re.fullmatch('[a-z0-9]+(?:-[a-z0-9]+)*', skill):
                        raise ValueError('invalid skill identity')
                    safe_file(root, 'skills/' + skill + '/index.md')
                if item.get('state', 'active') not in ('active', 'replaced'):
                    raise ValueError('invalid situation state')
                redirects = item.get('redirects', [])
                if not isinstance(redirects, list) or any(not isinstance(x, str) for x in redirects):
                    raise ValueError('redirects must be an id list')
                if (item.get('state', 'active') == 'replaced') != bool(redirects):
                    raise ValueError('replaced situations need redirects; active ones have none')
                events = item.get('events')
                if not isinstance(events, list) or not events:
                    raise ValueError('events must be a nonempty list')
                event_ids, inputs = set(), {rel: source_hash(path)}
                for event in events:
                    if not isinstance(event, dict):
                        raise ValueError('event must be an object')
                    eid = event.get('id')
                    require_text(eid, 'event.id')
                    if eid in event_ids:
                        raise ValueError('duplicate event id within situation')
                    event_ids.add(eid)
                    if event.get('identity') not in ('distinct', 'uncertain'):
                        raise ValueError('event identity must be distinct or uncertain')
                    require_text(event.get('summary'), 'event.summary')
                    if not isinstance(event.get('sources'), list) or not event['sources']:
                        raise ValueError('event needs source paths')
                    for source in event['sources']:
                        target = safe_file(root, source)
                        inputs[source] = source_hash(target)
                found[sid] = {'owner': rel, 'data': item, 'inputs': inputs,
                              'association_sha256': digest(encode(item))}
        except (ValueError, KeyError, TypeError, OSError, UnicodeError) as exc:
            errors.append({'path': rel, 'reason': str(exc)})
    def visit(sid, stack):
        if sid in stack:
            raise ValueError('redirect cycle at ' + sid)
        for target in found[sid]['data'].get('redirects', []):
            if target not in found:
                raise ValueError('unknown redirect ' + target)
            visit(target, stack | {sid})
    for sid in found:
        try:
            visit(sid, set())
        except ValueError as exc:
            errors.append({'path': found[sid]['owner'], 'reason': str(exc)})
    return found, errors


def assess(root, temporary=None):
    inv = inventory(root)
    situations, errors = collect(root)
    for kind in ('unregistered', 'missing'):
        errors.extend({'path': p, 'reason': kind + ' primary record'} for p in inv[kind])
    reuse = root / 'reuse'
    if reuse.is_symlink():
        raise ValueError('reuse directory must not be a symlink')
    if reuse.exists():
        for path in reuse.iterdir():
            if path.name == temporary:
                continue
            if path.name not in OUTPUTS or path.is_symlink() or not path.is_file():
                errors.append({'path': 'reuse/' + path.name, 'reason': 'unexpected reuse entry'})
    reviews = read_json(reuse / 'reviews.json', {'version': 1, 'situations': {}})
    ledger = read_json(reuse / 'screening.json', {'version': 1, 'snapshot': {}, 'records': {}})
    for name, data, field in [('reviews', reviews, 'situations'), ('screening', ledger, 'records')]:
        if not isinstance(data, dict) or data.get('version') != 1 or not isinstance(data.get(field), dict):
            raise ValueError('invalid ' + name + ' schema')
    if not isinstance(ledger.get('snapshot'), dict):
        raise ValueError('screening.snapshot must map paths to hashes')
    pending = []
    for sid, situation in situations.items():
        review = reviews['situations'].get(sid, {})
        if not isinstance(review, dict):
            raise ValueError('review entry must be an object')
        if (review.get('inputs') != situation['inputs'] or
                review.get('association_sha256') != situation['association_sha256']):
            pending.append(sid)
        elif not review.get('basis'):
            errors.append({'path': sid, 'reason': 'review acknowledgment needs a basis'})
    for sid in reviews['situations']:
        if sid not in situations:
            errors.append({'path': sid, 'reason': 'review references unknown situation'})
    screening_observed = {}
    coverage = {k: [] for k in ('unread', 'no-candidate', 'linked', 'unresolved', 'changed', 'added', 'removed')}
    for path, identity in inv['records'].items():
        entry = ledger['records'].get(path)
        if path not in ledger['snapshot']:
            coverage['added'].append(path)
        if entry is None:
            coverage['unread'].append(path)
            continue
        if not isinstance(entry, dict) or entry.get('disposition') not in DISPOSITIONS:
            errors.append({'path': path, 'reason': 'invalid screening disposition'})
            continue
        disposition = entry['disposition']
        if not isinstance(entry.get('situations', []), list):
            errors.append({'path': path, 'reason': 'invalid screening situation list'})
            continue
        links = entry.get('situations', [])
        if any(sid not in situations for sid in links):
            errors.append({'path': path, 'reason': 'screening references unknown situation'})
        if disposition == 'linked' and not links:
            errors.append({'path': path, 'reason': 'linked screening needs a situation'})
        if disposition != 'unread' and not entry.get('basis'):
            errors.append({'path': path, 'reason': 'screening needs an evidence basis'})
        changed = entry.get('sha256') != identity
        dependencies = entry.get('inputs', {})
        if not isinstance(dependencies, dict):
            errors.append({'path': path, 'reason': 'screening inputs must map paths to hashes'})
            dependencies = {}
        for dependency, expected in dependencies.items():
            try:
                if not isinstance(expected, str) or not re.fullmatch('[0-9a-f]{64}', expected):
                    raise ValueError('invalid screening dependency hash')
                observed = source_hash(safe_file(root, dependency))
                screening_observed[dependency] = observed
                if observed != expected:
                    changed = True
            except (OSError, ValueError, UnicodeError) as exc:
                changed = True
                errors.append({'path': dependency, 'reason': str(exc)})
        if changed:
            coverage['changed'].append(path)
        coverage[disposition].append(path)
    coverage['removed'] = sorted((set(ledger['snapshot']) | set(ledger['records'])) - set(inv['records']))
    payload = {'inventory': inv, 'situations': situations, 'reviews': reviews, 'screening': ledger, 'screening_observed': screening_observed}
    return {'version': 1, 'errors': errors, 'review_needed': sorted(pending),
            'coverage': coverage, 'situations': situations, 'input_sha256': digest(encode(payload))}


def cell(text):
    return str(text).replace('|', '\\|').replace('\n', ' ').replace('\r', ' ')


def render_text(report):
    lines = ['# Evolution situations', '', 'Generated view. Edit the owning record, then render again.', '',
             'Input identity: `' + report['input_sha256'] + '`', '',
             'Coverage: ' + '; '.join(k + '=' + str(len(v)) for k, v in report['coverage'].items()) + '.',
             'Counts describe screening states, not independent events. See screening.json for exact paths.', '',
             '| Situation | When to use / exclusions | Skills / search language | Owner | Review |',
             '| --- | --- | --- | --- | --- |']
    for sid, entry in sorted(report['situations'].items()):
        item = entry['data']
        applies = item['applicability']
        review = 'Needed' if sid in report['review_needed'] else 'Recorded inputs match'
        state = '' if item.get('state', 'active') == 'active' else ' → ' + ', '.join(item['redirects'])
        lines.append('| ' + cell(sid + ': ' + item['situation'] + state) + ' | ' +
                     cell(applies['when'] + ' / Exclude: ' + applies['exclude']) + ' | ' +
                     cell(', '.join(item['skills']) + ' / ' + ', '.join(item['search_terms'])) +
                     ' | [Record](../' + entry['owner'] + ') | ' + review + ' |')
    return '\n'.join(lines) + '\n'


def run(command, root):
    root = Path(root).absolute()
    if root.is_symlink() or not root.is_dir():
        raise ValueError('history root must be an existing nonsymlink directory')
    if command == 'inventory':
        return inventory(root), 0
    report = assess(root)
    expected = render_text(report)
    output = root / 'reuse/index.md'
    if output.is_symlink():
        raise ValueError('generated output must not be a symlink')
    matches = output.exists() and output.read_text(encoding='utf-8') == expected
    report['navigation'] = 'current' if matches else 'stale'
    if command == 'render' and not report['errors']:
        current = assess(root)
        if current['errors'] or current['input_sha256'] != report['input_sha256']:
            raise ValueError('inputs changed during generation; retry from current inputs')
        output.parent.mkdir(exist_ok=True)
        fd, name = tempfile.mkstemp(prefix='.index-', dir=output.parent)
        try:
            with os.fdopen(fd, 'w', encoding='utf-8') as stream:
                stream.write(expected)
            current = assess(root, Path(name).name)
            if current['errors'] or current['input_sha256'] != report['input_sha256']:
                raise ValueError('inputs changed before replacement')
            os.replace(name, output)
        finally:
            if Path(name).exists():
                Path(name).unlink()
        report['navigation'] = 'current'
    # Return expected review inputs to help a reviewer record an explicit acknowledgment.
    report['expected_reviews'] = {sid: {'inputs': x['inputs'], 'association_sha256': x['association_sha256']}
                                  for sid, x in report.pop('situations').items()}
    code = 1 if report['errors'] or report['navigation'] != 'current' else 0
    return report, code


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=('inventory', 'render', 'check'))
    parser.add_argument('--history-root', required=True, type=Path)
    args = parser.parse_args(argv)
    try:
        result, code = run(args.command, args.history_root)
    except (OSError, ValueError, KeyError, TypeError, UnicodeError) as exc:
        result, code = {'status': 'incomplete', 'reason': str(exc)}, 2
    print(json.dumps(result, indent=2, ensure_ascii=False))
    return code


if __name__ == '__main__':
    raise SystemExit(main())
