"""Verify the API image works even when deployment source files are private."""
import pathlib
import subprocess
import tarfile
import tempfile


root = pathlib.Path(__file__).resolve().parents[1]
files = ["package.json", "package-lock.json", "server/package.json",
         "client/package.json", "server/Dockerfile"]
files += [p.relative_to(root).as_posix()
          for p in (root / "server/src").rglob("*") if p.is_file()]
tag = "campusfix-api:permissions-test"

with tempfile.TemporaryFile() as context:
    with tarfile.open(fileobj=context, mode="w", format=tarfile.USTAR_FORMAT) as archive:
        for name in files:
            info = archive.gettarinfo(str(root / name), arcname=name)
            info.mode = 0o600
            with (root / name).open("rb") as source:
                archive.addfile(info, source)
    context.seek(0)
    subprocess.run(["docker", "build", "-f", "server/Dockerfile", "-t", tag, "-"],
                   input=context.read(), check=True)

subprocess.run([
    "docker", "run", "--rm", "--network", "none", "--entrypoint", "node", tag,
    "--input-type=module", "-e", """
import { readFileSync } from 'node:fs';
if (process.getuid() === 0) throw new Error('API must run as non-root');
for (const path of ['package.json', 'server/package.json', 'client/package.json']) {
  JSON.parse(readFileSync(`/app/${path}`, 'utf8'));
}
await import('./server/src/csrf.js');
console.log('PASS: non-root API can read private-context manifests and load application code');
"""], check=True)
