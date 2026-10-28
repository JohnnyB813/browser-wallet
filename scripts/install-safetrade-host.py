#!/usr/bin/env python3
"""Register the SafeTrade IPv4 host with the browsers on this machine.

Windows reads the loaded unpacked extension's exact ID from browser metadata
or accepts --extension-id. Linux derives the unpacked Chromium ID from the
build path; Firefox uses the gecko ID from the extension manifest.
"""

import argparse
import hashlib
import json
import os
import re
import shutil
import stat
import sys
from pathlib import Path

HOST_NAME = "com.warthog.safetrade"
GECKO_ID = "contact@warthog.network"
ROOT = Path(__file__).resolve().parent.parent
BUILD = Path(os.environ.get("WARTHOG_EXTENSION_BUILD", ROOT / "build")).resolve()
HOST = Path(__file__).resolve().parent / "safetrade-native-host.py"
WINDOWS_BROWSERS = {
    "chrome": ("Google/Chrome/User Data", r"Software\Google\Chrome"),
    "brave": ("BraveSoftware/Brave-Browser/User Data", r"Software\BraveSoftware\Brave-Browser"),
    "edge": ("Microsoft/Edge/User Data", r"Software\Microsoft\Edge"),
    "chromium": ("Chromium/User Data", r"Software\Chromium"),
}


def extension_id(path: Path) -> str:
    digest = hashlib.sha256(str(path).encode()).digest()[:16]
    return "".join(chr(ord("a") + nibble) for byte in digest for nibble in (byte >> 4, byte & 0xF))


def write_json(directory: Path, payload: dict) -> Path:
    directory.mkdir(parents=True, exist_ok=True)
    target = directory / f"{HOST_NAME}.json"
    target.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    os.chmod(target, stat.S_IRUSR | stat.S_IWUSR | stat.S_IRGRP | stat.S_IROTH)
    print(target)
    return target


def discover_windows_extensions(build: Path, local_appdata: Path, browser: str | None = None) -> list[tuple[str, str]]:
    """Read extension metadata and match the exact unpacked build path."""
    found = set()
    wanted = os.path.normcase(str(build.resolve()))
    for name, (profile_path, _) in WINDOWS_BROWSERS.items():
        if browser and browser != name:
            continue
        directory = local_appdata / profile_path
        if not directory.is_dir():
            continue
        for profile in directory.iterdir():
            if profile.name != "Default" and not profile.name.startswith("Profile "):
                continue
            for filename in ("Preferences", "Secure Preferences"):
                try:
                    data = json.loads((profile / filename).read_text(encoding="utf-8"))
                except (OSError, ValueError):
                    continue
                extensions = data.get("extensions") if isinstance(data, dict) else None
                settings = extensions.get("settings") if isinstance(extensions, dict) else None
                if not isinstance(settings, dict):
                    continue
                for identity, record in settings.items():
                    if not isinstance(record, dict):
                        continue
                    path = record.get("path")
                    if not isinstance(path, str) or not re.fullmatch(r"[a-p]{32}", identity):
                        continue
                    if os.path.normcase(str(Path(path).resolve())) == wanted:
                        found.add((name, identity))
    return sorted(found)


def windows_launcher(python: Path, host: Path) -> str:
    paths = [str(python.resolve()), str(host.resolve())]
    if any(any(char in path for char in '\r\n"') for path in paths):
        raise ValueError("Invalid Python or native host path")
    python_path, host_path = (path.replace("%", "%%") for path in paths)
    return f'@echo off\r\nsetlocal DisableDelayedExpansion\r\n"{python_path}" -u "{host_path}"\r\n'


def register_windows(browser: str, manifest: Path) -> None:
    import winreg

    bases = [WINDOWS_BROWSERS[browser][1]]
    if browser == "brave":
        bases.append(WINDOWS_BROWSERS["chrome"][1])
    for base in bases:
        key_path = f"{base}\\NativeMessagingHosts\\{HOST_NAME}"
        for view in (winreg.KEY_WOW64_32KEY, winreg.KEY_WOW64_64KEY):
            with winreg.CreateKeyEx(winreg.HKEY_CURRENT_USER, key_path, 0, winreg.KEY_WRITE | view) as key:
                winreg.SetValueEx(key, "", 0, winreg.REG_SZ, str(manifest.resolve()))
        print(f"Registered HKCU\\{key_path}")


def install_windows(args: argparse.Namespace) -> None:
    build = args.build_dir.resolve()
    if args.extension_id:
        matches = [(args.browser or "chrome", args.extension_id)]
    else:
        matches = discover_windows_extensions(build, Path(os.environ["LOCALAPPDATA"]), args.browser)
    if not matches:
        raise ValueError("Load the wallet build in your browser first, or pass --browser and --extension-id from the browser's extensions page.")
    if not shutil.which("curl.exe"):
        raise ValueError("curl.exe was not found. Install curl and rerun this installer.")
    for browser, identity in matches:
        print(f"{browser}: chrome-extension://{identity}/ (build: {build})")
    if args.dry_run:
        return
    directory = ROOT / ".native-host"
    directory.mkdir(exist_ok=True)
    launcher = directory / "safetrade-native-host.bat"
    launcher.write_bytes(windows_launcher(Path(sys.executable), HOST).encode("utf-8"))
    manifest = write_json(directory, {
        "name": HOST_NAME,
        "description": "Forward SafeTrade calls over IPv4",
        "path": str(launcher),
        "type": "stdio",
        "allowed_origins": sorted({f"chrome-extension://{identity}/" for _, identity in matches}),
    })
    for browser in sorted({name for name, _ in matches}):
        register_windows(browser, manifest)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--browser", choices=WINDOWS_BROWSERS, help="Windows browser; otherwise detect the loaded wallet")
    parser.add_argument("--extension-id", help="Exact ID from the browser's extensions page")
    parser.add_argument("--build-dir", type=Path, default=BUILD)
    parser.add_argument("--dry-run", action="store_true", help="Show Windows registration without changing it")
    args = parser.parse_args()
    if args.extension_id and not re.fullmatch(r"[a-p]{32}", args.extension_id):
        parser.error("--extension-id must be exactly 32 letters a-p")
    if sys.platform == "win32":
        try:
            install_windows(args)
        except (OSError, ValueError) as error:
            parser.exit(1, f"{error}\n")
        return
    if sys.platform != "linux":
        parser.exit(1, "This installer currently supports Windows and Linux.\n")
    if args.dry_run:
        print(f"Linux host: {HOST}; extension ID: {args.extension_id or extension_id(args.build_dir.resolve())}")
        return
    os.chmod(HOST, stat.S_IRWXU | stat.S_IRGRP | stat.S_IXGRP | stat.S_IROTH | stat.S_IXOTH)
    origin = f"chrome-extension://{args.extension_id or extension_id(args.build_dir.resolve())}/"
    chromium = {
        "name": HOST_NAME,
        "description": "Forward SafeTrade calls over IPv4",
        "path": str(HOST),
        "type": "stdio",
        "allowed_origins": [origin],
    }
    firefox = {
        "name": HOST_NAME,
        "description": "Forward SafeTrade calls over IPv4",
        "path": str(HOST),
        "type": "stdio",
        "allowed_extensions": [GECKO_ID],
    }
    home = Path.home()
    browsers = [
        home / ".config/BraveSoftware/Brave-Browser-Beta",
        home / ".config/BraveSoftware/Brave-Browser",
        home / ".config/google-chrome",
        home / ".config/chromium",
    ]
    for browser in browsers:
        if browser.is_dir():
            write_json(browser / "NativeMessagingHosts", chromium)
    mozilla = home / ".mozilla"
    if mozilla.is_dir():
        write_json(mozilla / "native-messaging-hosts", firefox)
    snap = home / "snap/firefox/common"
    if snap.is_dir():
        write_json(snap / ".mozilla/native-messaging-hosts", firefox)
    print(origin)


if __name__ == "__main__":
    main()
