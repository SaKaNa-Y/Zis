import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

SCRIPT = Path(__file__).parents[1] / 'scripts/evaluation_record.py'


class RecordTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        for name in ('skill.md', 'input.md'):
            (self.root / name).write_text(name)

    def run_cli(self, *args, ok=True):
        p = subprocess.run([sys.executable, str(SCRIPT), *map(str, args)], capture_output=True, text=True, cwd=self.root)
        self.assertEqual(p.returncode, 0 if ok else 1, p.stdout + p.stderr)
        return p

    def start(self):
        return self.run_cli('start', '--root', self.root, '--record', self.root / 'start.json', '--skill', 'skill.md', '--input', 'input.md', '--expect', 'answer.md', '--session-mode', 'fresh')

    def finish(self, ok=True):
        return self.run_cli('finish', '--start', self.root / 'start.json', '--record', self.root / 'finish.json', '--evidence', 'trace.json', ok=ok)

    def output(self):
        (self.root / 'answer.md').write_text('actual output')
        (self.root / 'trace.json').write_text('{"session": "host-123"}')

    def test_lifecycle_and_freshness_boundary(self):
        self.start()
        self.output()
        self.finish()
        p = self.run_cli('verify', '--record', self.root / 'finish.json')
        self.assertEqual(json.loads(p.stdout)['evaluation_outcome'], 'not-assessed')
        data = json.loads((self.root / 'finish.json').read_text())
        self.assertEqual(data['declared']['session_mode'], 'fresh')
        self.assertEqual(data['isolation_check'], 'not-performed')
        self.assertEqual(data['declared']['model'], 'unknown')

    def test_stale_output_rejected(self):
        (self.root / 'answer.md').write_text('earlier trial')
        self.assertIn('Output already exists', self.run_cli('start', '--root', self.root, '--record', self.root / 'start.json', '--skill', 'skill.md', '--input', 'input.md', '--expect', 'answer.md', ok=False).stderr)
        self.assertFalse((self.root / 'start.json').exists())
        self.assertEqual((self.root / 'answer.md').read_text(), 'earlier trial')

    def test_skill_changed_before_finish(self):
        self.start()
        self.output()
        (self.root / 'skill.md').write_text('new version')
        self.assertIn('File changed', self.finish(ok=False).stderr)
        self.assertFalse((self.root / 'finish.json').exists())

    def test_changed_artifact(self):
        self.start()
        self.output()
        self.finish()
        (self.root / 'answer.md').write_text('revised output')
        self.assertIn('File changed', self.run_cli('verify', '--record', self.root / 'finish.json', ok=False).stderr)

    def test_missing_output(self):
        self.start()
        (self.root / 'trace.json').write_text('{}')
        self.assertIn('Missing regular file', self.finish(ok=False).stderr)

    def test_missing_evidence(self):
        self.start()
        (self.root / 'answer.md').write_text('answer')
        self.assertIn('Missing regular file', self.finish(ok=False).stderr)

    def test_malformed_records(self):
        for bad in ('{', '[]', '{"schema":1}', '{"schema":999}'):
            (self.root / 'bad.json').write_text(bad)
            self.run_cli('verify', '--record', self.root / 'bad.json', ok=False)

    def test_immutable_records(self):
        self.start()
        before = (self.root / 'start.json').read_bytes()
        self.run_cli('start', '--root', self.root, '--record', self.root / 'start.json', '--skill', 'skill.md', '--input', 'input.md', '--expect', 'answer.md', ok=False)
        self.assertEqual(before, (self.root / 'start.json').read_bytes())

    def test_forged_isolation_attestation_rejected(self):
        self.start()
        data = json.loads((self.root / 'start.json').read_text())
        data['isolation_check'] = 'verified'
        (self.root / 'bad.json').write_text(json.dumps(data))
        self.assertIn('cannot attest', self.run_cli('verify', '--record', self.root / 'bad.json', ok=False).stderr)

    def test_start_record_changed(self):
        self.start()
        self.output()
        self.finish()
        with (self.root / 'start.json').open('a') as f:
            f.write('\n')
        self.assertIn('Start record changed', self.run_cli('verify', '--record', self.root / 'finish.json', ok=False).stderr)

    def test_relocation(self):
        self.start()
        self.output()
        self.finish()
        import shutil
        relocated = self.root / 'relocated'
        relocated.mkdir()
        for item in self.root.iterdir():
            if item.is_file():
                shutil.copy2(item, relocated / item.name)
        self.run_cli('verify', '--record', relocated / 'finish.json', '--root', relocated)

    def test_outside_root_rejected(self):
        self.run_cli('start', '--root', self.root, '--record', self.root / 'start.json', '--skill', '../missing', '--input', 'input.md', '--expect', 'answer.md', ok=False)


if __name__ == '__main__':
    unittest.main()
