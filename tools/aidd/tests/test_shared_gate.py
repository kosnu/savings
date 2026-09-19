"""実際の共有設定・pre-commit・vpを一時Gitリポジトリで検証する。"""

import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest


REPOSITORY = Path(__file__).resolve().parents[3]
GO_FILE = "tools/aidd/checker/main.go"
GOOD_GO = 'package main\n\nimport "fmt"\n\nfunc main() { fmt.Println("ok") }\n'
BAD_GO = 'package main\n\nimport "fmt"\n\nfunc main() { fmt.Printf("%d", "bad") }\n'


class SharedGateTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory(prefix="shared gate ")
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.env = {k: v for k, v in os.environ.items() if not k.startswith("GIT_")}
        node = subprocess.run(
            ["node", "-p", "process.execPath"], cwd=REPOSITORY, env=self.env,
            capture_output=True, text=True, check=True, timeout=30,
        ).stdout.strip()
        self.env.update(
            GIT_CONFIG_NOSYSTEM="1",
            GIT_CONFIG_GLOBAL=os.devnull,
            GIT_TERMINAL_PROMPT="0",
            GOENV="off",
            GOWORK="off",
            GOFLAGS="",
            GOTOOLCHAIN="local",
            PATH=os.pathsep.join((str(REPOSITORY / "node_modules/.bin"), str(Path(node).parent), os.environ["PATH"])),
        )
        for command in ("git", "go", "gofmt", "node", "vp"):
            self.assertIsNotNone(shutil.which(command, path=self.env["PATH"]), command)
        self.run_command("git", "init", "-q")
        self.run_command("git", "config", "user.name", "Shared Gate Test")
        self.run_command("git", "config", "user.email", "shared-gate@example.invalid")
        self.run_command("git", "config", "commit.gpgsign", "false")
        self.write(".gitignore", "node_modules/\n")
        self.write("package.json", '{"private":true,"type":"module"}\n')
        self.write("tools/aidd/checker/go.mod", "module example.invalid/shared-gate\n\ngo 1.24\n")
        self.write(GO_FILE, GOOD_GO)
        self.write("tools/aidd/checker/helper.go", "package main\n\nfunc helper() {}\n")
        self.write("note.txt", "before\n")
        self.write("remove.txt", "remove me\n")
        (self.root / "node_modules").symlink_to(REPOSITORY / "node_modules", target_is_directory=True)
        shutil.copy2(REPOSITORY / "vite.config.ts", self.root / "vite.config.ts")
        shutil.copytree(REPOSITORY / ".vite-hooks", self.root / ".vite-hooks")
        self.run_command("git", "add", ".")
        self.run_command("git", "-c", "core.hooksPath=/dev/null", "commit", "-qm", "fixture")
        self.run_command("git", "config", "core.hooksPath", ".vite-hooks")

    def write(self, path, content):
        target = self.root / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content)

    def run_command(self, *argv, success=True):
        result = subprocess.run(argv, cwd=self.root, env=self.env, capture_output=True, timeout=120)
        if success:
            self.assertEqual(result.returncode, 0, result.stdout.decode() + result.stderr.decode())
        return result

    def git_bytes(self, *args):
        return self.run_command("git", *args).stdout

    def commit(self, success=True):
        return self.run_command("git", "commit", "-qm", "exercise actual hook", success=success)

    def assert_blocked_and_restored(self):
        before = [self.git_bytes(*args) for args in (
            ("rev-parse", "HEAD"), ("diff", "--cached", "--binary"),
            ("diff", "--binary"), ("status", "--porcelain"), ("stash", "list"),
        )]
        result = self.commit(success=False)
        self.assertNotEqual(result.returncode, 0, "vet失敗でcommitが止まらない")
        self.assertIn(b"fmt.Printf", result.stdout + result.stderr)
        after = [self.git_bytes(*args) for args in (
            ("rev-parse", "HEAD"), ("diff", "--cached", "--binary"),
            ("diff", "--binary"), ("status", "--porcelain"), ("stash", "list"),
        )]
        self.assertEqual(after, before, "失敗時にHEAD/index/未ステージ差分/stashを保持する")

    def test_format_and_preserve_unstaged(self):
        staged = GOOD_GO.replace('fmt.Println("ok")', 'fmt.Println( "staged" )')
        self.write(GO_FILE, staged)
        self.run_command("git", "add", GO_FILE)
        # 同じファイルの別hunkと、完全に未ステージの変更を保護する。
        unstaged = "\n// unstaged marker\n"
        self.write(GO_FILE, staged + unstaged)
        self.write("note.txt", "unstaged note\n")
        hidden_go = BAD_GO.replace("func main()", "func helper()")
        self.write("tools/aidd/checker/helper.go", hidden_go)
        expected = subprocess.run(["gofmt"], input=staged.encode(), capture_output=True, check=True).stdout
        self.commit()
        self.assertEqual(self.git_bytes("show", "HEAD:" + GO_FILE), expected)
        self.assertEqual((self.root / GO_FILE).read_bytes(), expected + unstaged.encode())
        self.assertEqual(self.git_bytes("show", "HEAD:note.txt"), b"before\n")
        self.assertEqual((self.root / "note.txt").read_bytes(), b"unstaged note\n")
        self.assertEqual((self.root / "tools/aidd/checker/helper.go").read_text(), hidden_go)
        self.assertEqual(self.git_bytes("show", "HEAD:tools/aidd/checker/helper.go"), b"package main\n\nfunc helper() {}\n")
        self.assertEqual(self.git_bytes("diff", "--cached"), b"")
        self.assertEqual(self.git_bytes("stash", "list"), b"")

    def test_vet_failure_blocks_commit(self):
        self.write(GO_FILE, BAD_GO.replace("fmt.Printf(", "fmt.Printf( "))
        self.run_command("git", "add", GO_FILE)
        self.write(GO_FILE, (self.root / GO_FILE).read_text() + "\n// unstaged marker\n")
        self.write("note.txt", "unstaged note\n")
        self.assert_blocked_and_restored()

    def seed_vet_failure(self):
        # 検証対象のcommitにはGo変更を含めず、module全体のvet実行を観測する。
        self.write(GO_FILE, BAD_GO)
        self.run_command("git", "add", GO_FILE)
        self.run_command("git", "-c", "core.hooksPath=/dev/null", "commit", "-qm", "invalid baseline")

    def test_non_go_runs_vet(self):
        self.seed_vet_failure()
        self.write("note.txt", "staged note\n")
        self.run_command("git", "add", "note.txt")
        self.assert_blocked_and_restored()

    def test_deletion_runs_vet(self):
        self.run_command("git", "rm", "remove.txt")
        self.commit()
        self.assertFalse((self.root / "remove.txt").exists())
        self.seed_vet_failure()
        self.run_command("git", "rm", "note.txt")
        self.assert_blocked_and_restored()

    def test_check_and_canonical_json(self):
        canonical = '{\n  "a": [\n    1,\n    2\n  ]\n}\n'
        self.write(".aidd/tasks/fixture/task.json", canonical)
        self.write("example.json", canonical)
        self.run_command("git", "add", ".aidd", "example.json")
        self.commit()
        self.assertEqual(self.git_bytes("show", "HEAD:.aidd/tasks/fixture/task.json"), canonical.encode())
        self.assertEqual((self.root / ".aidd/tasks/fixture/task.json").read_bytes(), canonical.encode())
        self.assertNotEqual(self.git_bytes("show", "HEAD:example.json"), canonical.encode())
        self.assertEqual(self.git_bytes("status", "--porcelain"), b"")


if __name__ == "__main__":
    unittest.main()
