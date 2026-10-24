#!/usr/bin/env python3
"""Register the SafeTrade IPv4 host with the browsers on this machine.

The unpacked Chromium id is the first 16 bytes of SHA-256 of the absolute
build path, with each hex nibble mapped onto a-p. Firefox uses the gecko id
from the extension manifest.
"""

import hashlib
import json
import os
import stat
from pathlib import Path

HOST_NAME = "com.warthog.safetrade"
GECKO_ID = "contact@warthog.network"
BUILD = Path("/home/whitefang/webdev/browser-wallet/build")
HOST = Path(__file__).resolve().parent / "safetrade-native-host.py"


def extension_id(path: Path) -> str:
    digest = hashlib.sha256(str(path).encode()).digest()[:16]
    return "".join(chr(ord("a") + nibble) for byte in digest for nibble in (byte >> 4, byte & 0xF))


def write_json(directory: Path, payload: dict) -> None:
    directory.mkdir(parents=True, exist_ok=True)
    target = directory / f"{HOST_NAME}.json"
    target.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    os.chmod(target, stat.S_IRUSR | stat.S_IWUSR | stat.S_IRGRP | stat.S_IROTH)
    print(target)


def main() -> None:
    os.chmod(HOST, stat.S_IRWXU | stat.S_IRGRP | stat.S_IXGRP | stat.S_IROTH | stat.S_IXOTH)
    origin = f"chrome-extension://{extension_id(BUILD)}/"
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
