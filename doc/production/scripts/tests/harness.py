"""Run a resolve/*.py script against the fake Resolve module, the way rr.sh runs it (argv, exec, SystemExit code).

    from harness import run, fake
    code, out = run("resolve/post_delivery.py", ["Song"], project)
"""
import contextlib, io, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPTS = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(HERE, "fake_resolve"))
import DaVinciResolveScript as fake  # noqa: E402


def run(script, args, project):
    fake.PROJECT = project
    path = os.path.join(SCRIPTS, script)
    old_argv, buf, code = sys.argv, io.StringIO(), 0
    sys.argv = [path] + [str(a) for a in args]
    try:
        with contextlib.redirect_stdout(buf), contextlib.redirect_stderr(buf):
            try:
                exec(compile(open(path).read(), path, "exec"), {"__name__": "__main__"})
            except SystemExit as e:
                if e.code not in (None, 0):
                    code = e.code if isinstance(e.code, int) else 1
                    if not isinstance(e.code, int): print(e.code)
    finally:
        sys.argv = old_argv
    return code, buf.getvalue()
