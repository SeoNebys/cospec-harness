"""One-click launcher (FR-019).

Starts the single local process that serves both the API and the built UI, then opens the
user's default browser to it — no terminal, commands, or configuration for the user. This
module is the entry point the packaged desktop app / shortcut runs.
"""

import socket
import threading
import time
import webbrowser

import uvicorn

from .api.main import app

HOST = "127.0.0.1"
PREFERRED_PORT = 8765


def _find_free_port(preferred: int = PREFERRED_PORT) -> int:
    """Use the preferred port if available, otherwise let the OS assign one."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind((HOST, preferred))
            return preferred
        except OSError:
            pass
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind((HOST, 0))
        return s.getsockname()[1]


def _open_browser_when_ready(url: str, port: int, timeout: float = 15.0) -> None:
    """Poll until the server accepts connections, then open the browser once."""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(0.5)
            if s.connect_ex((HOST, port)) == 0:
                webbrowser.open(url)
                return
        time.sleep(0.2)


def main() -> None:
    port = _find_free_port()
    url = f"http://{HOST}:{port}"
    print(f"Bookmark Manager is starting at {url}")
    print("Your browser will open automatically. Close this window to quit.")

    threading.Thread(
        target=_open_browser_when_ready, args=(url, port), daemon=True
    ).start()

    uvicorn.run(app, host=HOST, port=port, log_level="warning")


if __name__ == "__main__":
    main()
