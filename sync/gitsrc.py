"""Read files straight from a git ref (default origin/dev) without touching the working copy.
One `git cat-file --batch` process per repo, so thousands of files read quickly."""
import subprocess

REF = "origin/dev"


class GitSrc:
    def __init__(self, path, ref=REF):
        self.path, self.ref = path, ref
        self._files = None

    def ok(self):
        return subprocess.run(["git", "-C", self.path, "rev-parse", "--verify", "-q", self.ref + "^{commit}"],
                              capture_output=True).returncode == 0

    def files(self, prefix=""):
        if self._files is None:
            out = subprocess.run(["git", "-C", self.path, "ls-tree", "-r", "--name-only", self.ref],
                                 capture_output=True, text=True).stdout
            self._files = out.splitlines()
        return [f for f in self._files if f.startswith(prefix)]

    def read_many(self, paths):
        """Yield (path, text) for each path, via one cat-file process."""
        if not paths:
            return
        p = subprocess.Popen(["git", "-C", self.path, "cat-file", "--batch"], stdin=subprocess.PIPE, stdout=subprocess.PIPE)
        data, _ = p.communicate(("\n".join(f"{self.ref}:{x}" for x in paths) + "\n").encode())
        i = 0
        for path in paths:
            nl = data.index(b"\n", i)
            header = data[i:nl].split()
            i = nl + 1
            if len(header) < 3 or header[1] == b"missing":
                continue
            size = int(header[2])
            yield path, data[i:i + size].decode("utf-8", "replace")
            i += size + 1

    def read(self, path):
        for _, t in self.read_many([path]):
            return t
        return ""

    def head(self):
        out = subprocess.run(["git", "-C", self.path, "log", "-1", "--format=%h%x09%cs%x09%an%x09%s", self.ref],
                             capture_output=True, text=True).stdout.strip().split("\t")
        return {"branch": self.ref, "commit": out[0] if out else "", "date": out[1] if len(out) > 1 else "",
                "author": out[2] if len(out) > 2 else "", "subject": out[3] if len(out) > 3 else ""}
