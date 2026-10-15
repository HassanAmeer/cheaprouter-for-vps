#!/usr/bin/env python3
"""
Quick VPS Apply & Sync Tool
Syncs modified files from local workspace to VPS targets (/root/cheaprouter and /root/vscode/cheaprouter-for-vps)
and restarts the cheaprouter systemd service within seconds.

Usage:
    python3 scripts/ops/quick-vps-apply.py               # Auto-sync all git-modified files
    python3 scripts/ops/quick-vps-apply.py file1 file2   # Sync specific files
"""

import sys
import os
import subprocess
import time
import paramiko

VPS_HOST = "201.18.218.29"
VPS_USER = "root"
VPS_PASS = "Devbest309@gmail.com"
VPS_TARGETS = [
    "/root/cheaprouter",
    "/root/vscode/cheaprouter-for-vps"
]

LOCAL_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))

def get_modified_files():
    """Detect modified, staged, or untracked files via git status."""
    try:
        res = subprocess.run(
            ["git", "status", "--porcelain"],
            cwd=LOCAL_ROOT,
            capture_output=True,
            text=True,
            check=True
        )
        files = []
        for raw_line in res.stdout.splitlines():
            line = raw_line.rstrip()
            if not line:
                continue
            path = line[3:].strip().strip('"')
            if (
                path.startswith("src/") or
                path.startswith("open-sse/") or
                path.startswith("bin/") or
                path.startswith("public/") or
                path.endswith(".ts") or
                path.endswith(".tsx") or
                path.endswith(".json")
            ):
                if os.path.isfile(os.path.join(LOCAL_ROOT, path)):
                    files.append(path)
        return sorted(list(set(files)))
    except Exception as e:
        print(f"Git status error: {e}", flush=True)
        return []

def main():
    t_start = time.time()
    args = sys.argv[1:]

    if args:
        files = []
        for a in args:
            rel = os.path.relpath(os.path.abspath(a), LOCAL_ROOT) if os.path.isabs(a) else a
            if os.path.isfile(os.path.join(LOCAL_ROOT, rel)):
                files.append(rel)
    else:
        files = get_modified_files()

    if not files:
        print("⚡ No modified code files detected to sync.", flush=True)
        return

    print(f"🚀 Quick VPS Apply: Syncing {len(files)} file(s) to {VPS_HOST}...", flush=True)
    for f in files:
        size = os.path.getsize(os.path.join(LOCAL_ROOT, f))
        print(f"   • {f} ({size} bytes)", flush=True)

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(VPS_HOST, username=VPS_USER, password=VPS_PASS, timeout=10, look_for_keys=False, allow_agent=False)
    sftp = ssh.open_sftp()

    known_dirs = set()

    for target_base in VPS_TARGETS:
        for rel_path in files:
            local_path = os.path.join(LOCAL_ROOT, rel_path)
            remote_path = os.path.join(target_base, rel_path)
            
            # ensure remote directory exists once
            remote_dir = os.path.dirname(remote_path)
            if remote_dir not in known_dirs:
                parts = remote_dir.strip("/").split("/")
                curr = ""
                for p in parts:
                    curr += "/" + p
                    if curr not in known_dirs:
                        try:
                            sftp.stat(curr)
                            known_dirs.add(curr)
                        except IOError:
                            try:
                                sftp.mkdir(curr)
                                known_dirs.add(curr)
                            except Exception:
                                pass
                known_dirs.add(remote_dir)

            with open(local_path, "rb") as fp:
                data = fp.read()
            with sftp.open(remote_path, "wb") as fp:
                fp.write(data)

    sftp.close()

    print("🔄 Restarting cheaprouter systemd service...", flush=True)
    stdin, stdout, stderr = ssh.exec_command(
        "systemctl restart cheaprouter && sleep 2 && systemctl is-active cheaprouter"
    )
    status = stdout.read().decode("utf-8", errors="replace").strip()
    
    # Quick health check
    stdin, stdout, stderr = ssh.exec_command(
        "curl -s --max-time 3 http://127.0.0.1:20128/api/health/ping || echo 'starting'"
    )
    health = stdout.read().decode("utf-8", errors="replace").strip()
    ssh.close()

    elapsed = round(time.time() - t_start, 2)
    print(f"✅ Synced & Applied in {elapsed}s! Service status: {status} (Health: {health})", flush=True)

if __name__ == "__main__":
    main()
