#!/usr/bin/env python3

from __future__ import annotations

from collections import defaultdict
from pathlib import Path
import json
import re
import subprocess
import sys
import xml.etree.ElementTree as ET


ROOT = Path(__file__).resolve().parent.parent
APP_ID = "nc_bitwarden"

IGNORED_DIRECTORIES = {
    ".git",
    "node_modules",
    "vendor",
    "vendor-bin",
    "js",
    "css",
    "__pycache__",
}

SOURCE_SUFFIXES = {
    ".php",
    ".js",
    ".ts",
    ".vue",
}

ROUTE_PATTERN = re.compile(
    r"""
    ['"]name['"]\s*=>\s*
    ['"]
    (?P<controller>[a-z0-9_]+)
    \#
    (?P<action>[A-Za-z0-9_]+)
    ['"]
    """,
    re.VERBOSE,
)

MERGE_MARKER_PATTERN = re.compile(
    r"(?m)^(<<<<<<<|=======|>>>>>>>)"
)

DEBUGGER_PATTERN = re.compile(
    r"(?m)^\s*debugger\s*;?\s*$"
)

DEBUG_CONSOLE_PATTERN = re.compile(
    r"\bconsole\.(?:log|debug|trace)\s*\("
)


def fail(message: str) -> None:
    print(
        f"FEHLER: {message}",
        file=sys.stderr,
    )
    raise SystemExit(1)


def run(
    command: list[str],
    *,
    capture: bool = False,
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command,
        cwd=ROOT,
        text=True,
        capture_output=capture,
        check=False,
    )


def read_json(path: Path) -> dict:
    if not path.is_file():
        fail(f"{path.relative_to(ROOT)} fehlt.")

    try:
        result = json.loads(
            path.read_text(encoding="utf-8")
        )
    except json.JSONDecodeError as exception:
        fail(
            f"{path.relative_to(ROOT)} ist "
            f"ungültiges JSON: {exception}"
        )

    if not isinstance(result, dict):
        fail(
            f"{path.relative_to(ROOT)} enthält "
            "kein JSON-Objekt."
        )

    return result


def source_files() -> list[Path]:
    result: list[Path] = []

    for path in ROOT.rglob("*"):
        if not path.is_file():
            continue

        relative = path.relative_to(ROOT)

        if any(
            part in IGNORED_DIRECTORIES
            for part in relative.parts
        ):
            continue

        if path.suffix not in SOURCE_SUFFIXES:
            continue

        result.append(path)

    return sorted(result)


def snake_to_pascal(value: str) -> str:
    return "".join(
        part[:1].upper() + part[1:]
        for part in value.split("_")
        if part
    )


def check_required_files() -> None:
    required = [
        "appinfo/info.xml",
        "appinfo/routes.php",
        "lib/AppInfo/AppConstants.php",
        "src/main.js",
        "src/App.vue",
        "l10n/de.php",
        "l10n/de.js",
        "l10n/de.json",
        "scripts/build-l10n.php",
        "scripts/check-l10n.py",
        "package.json",
    ]

    missing = [
        relative
        for relative in required
        if not (ROOT / relative).is_file()
    ]

    if missing:
        fail(
            "Erforderliche Dateien fehlen: "
            + ", ".join(missing)
        )

    print(
        "OK: Alle erforderlichen Dateien vorhanden."
    )


def check_app_identity_architecture() -> None:
    constants_path = (
        ROOT / "lib/AppInfo/AppConstants.php"
    )

    legacy_application_path = (
        ROOT / "lib/AppInfo/Application.php"
    )

    if legacy_application_path.exists():
        fail(
            "Die nicht benötigte Bootstrap-Klasse "
            "lib/AppInfo/Application.php ist wieder vorhanden."
        )

    constants_text = constants_path.read_text(
        encoding="utf-8"
    )

    app_id_pattern = re.compile(
        r"""
        public\s+const\s+APP_ID\s*=\s*
        ['"]nc_bitwarden['"]\s*;
        """,
        re.VERBOSE,
    )

    matches = list(
        app_id_pattern.finditer(constants_text)
    )

    if len(matches) != 1:
        fail(
            "AppConstants.php definiert APP_ID "
            "nicht genau einmal als nc_bitwarden."
        )

    stale_references: list[str] = []
    active_references: list[str] = []

    lib_directory = ROOT / "lib"

    for path in sorted(
        lib_directory.rglob("*.php")
    ):
        content = path.read_text(
            encoding="utf-8",
            errors="strict",
        )

        relative = str(
            path.relative_to(ROOT)
        )

        if (
            "OCA\\NcBitwarden\\AppInfo\\Application"
            in content
            or "Application::APP_ID" in content
        ):
            stale_references.append(relative)

        if "AppConstants::APP_ID" in content:
            active_references.append(relative)

    if stale_references:
        fail(
            "Veraltete Application-Verweise vorhanden: "
            + ", ".join(stale_references)
        )

    if not active_references:
        fail(
            "Keine Verwendung von AppConstants::APP_ID "
            "gefunden."
        )

    print(
        "OK: App-ID liegt in AppConstants."
    )

    print(
        "OK: Keine veraltete Bootstrap-Klasse "
        "oder Application::APP_ID-Verweise vorhanden."
    )

    print(
        "AppConstants-Verwendungen:",
        len(active_references),
    )

    for relative in active_references:
        print(f"  {relative}")


def check_versions() -> None:
    package = read_json(
        ROOT / "package.json"
    )

    package_version = str(
        package.get("version") or ""
    ).strip()

    info_path = ROOT / "appinfo/info.xml"

    try:
        info_root = ET.parse(
            info_path
        ).getroot()
    except ET.ParseError as exception:
        fail(
            "appinfo/info.xml ist ungültig: "
            f"{exception}"
        )

    app_id = str(
        info_root.findtext("id") or ""
    ).strip()

    info_version = str(
        info_root.findtext("version") or ""
    ).strip()

    if app_id != APP_ID:
        fail(
            "Unerwartete App-ID: "
            f"{app_id!r}"
        )

    versions = {
        "appinfo/info.xml": info_version,
        "package.json": package_version,
    }

    lock_path = ROOT / "package-lock.json"

    if lock_path.is_file():
        package_lock = read_json(lock_path)

        lock_version = str(
            package_lock.get("version") or ""
        ).strip()

        root_package = (
            package_lock
            .get("packages", {})
            .get("", {})
        )

        root_lock_version = str(
            root_package.get("version") or ""
        ).strip()

        if (
            lock_version
            and root_lock_version
            and lock_version != root_lock_version
        ):
            fail(
                "package-lock.json enthält "
                "unterschiedliche Versionsnummern: "
                f"{lock_version} und "
                f"{root_lock_version}."
            )

        effective_lock_version = (
            root_lock_version
            or lock_version
        )

        if effective_lock_version:
            versions[
                "package-lock.json"
            ] = effective_lock_version

    print("Versionsnummern:")

    for name, version in versions.items():
        print(f"  {name}: {version or 'FEHLT'}")

    missing = [
        name
        for name, version in versions.items()
        if not version
    ]

    if missing:
        fail(
            "Versionsnummer fehlt in: "
            + ", ".join(missing)
        )

    if len(set(versions.values())) != 1:
        fail(
            "Die Versionsnummern stimmen "
            "nicht überein."
        )

    print(
        "OK: Versionsnummern sind konsistent."
    )


def check_routes() -> None:
    routes_path = ROOT / "appinfo/routes.php"

    routes_text = routes_path.read_text(
        encoding="utf-8"
    )

    matches = list(
        ROUTE_PATTERN.finditer(routes_text)
    )

    if not matches:
        fail(
            "Keine Controller-Routen erkannt."
        )

    controllers: dict[
        str,
        set[str],
    ] = defaultdict(set)

    for match in matches:
        controllers[
            match.group("controller")
        ].add(
            match.group("action")
        )

    print()
    print(
        f"Controller-Gruppen: {len(controllers)}"
    )

    print(
        f"Erkannte Routen: {len(matches)}"
    )

    for controller, actions in sorted(
        controllers.items()
    ):
        class_name = (
            snake_to_pascal(controller)
            + "Controller"
        )

        path = (
            ROOT
            / "lib/Controller"
            / f"{class_name}.php"
        )

        print(
            f"  {controller}: "
            f"{class_name} "
            f"({len(actions)} Aktionen)"
        )

        if not path.is_file():
            fail(
                "Controller-Datei fehlt: "
                f"{path.relative_to(ROOT)}"
            )

        content = path.read_text(
            encoding="utf-8"
        )

        class_pattern = re.compile(
            rf"\bclass\s+"
            rf"{re.escape(class_name)}\b"
        )

        if not class_pattern.search(content):
            fail(
                f"{path.relative_to(ROOT)} "
                f"definiert nicht {class_name}."
            )

        for action in sorted(actions):
            method_pattern = re.compile(
                rf"\bfunction\s+"
                rf"{re.escape(action)}"
                rf"\s*\("
            )

            if not method_pattern.search(content):
                fail(
                    "Routenmethode fehlt: "
                    f"{class_name}::{action}()"
                )

    print(
        "OK: Alle Routen besitzen einen "
        "Controller und eine Methode."
    )


def check_php_syntax(
    paths: list[Path],
) -> None:
    php_files = [
        path
        for path in paths
        if path.suffix == ".php"
    ]

    print()
    print(
        f"PHP-Dateien geprüft: {len(php_files)}"
    )

    failures: list[str] = []

    for path in php_files:
        result = run(
            [
                "php",
                "-l",
                str(path),
            ],
            capture=True,
        )

        if result.returncode != 0:
            failures.append(
                result.stdout
                + result.stderr
            )

    if failures:
        print(
            "\n".join(failures),
            file=sys.stderr,
        )

        fail(
            "Mindestens eine PHP-Datei "
            "enthält einen Syntaxfehler."
        )

    print(
        "OK: PHP-Syntaxprüfung erfolgreich."
    )


def check_source_integrity(
    paths: list[Path],
) -> None:
    merge_markers: list[str] = []
    debugger_statements: list[str] = []
    debug_console: list[str] = []

    checks = [
        (
            MERGE_MARKER_PATTERN,
            merge_markers,
        ),
        (
            DEBUGGER_PATTERN,
            debugger_statements,
        ),
        (
            DEBUG_CONSOLE_PATTERN,
            debug_console,
        ),
    ]

    for path in paths:
        text = path.read_text(
            encoding="utf-8",
            errors="strict",
        )

        relative = path.relative_to(ROOT)

        for pattern, destination in checks:
            for match in pattern.finditer(text):
                line = (
                    text.count(
                        "\n",
                        0,
                        match.start(),
                    )
                    + 1
                )

                destination.append(
                    f"{relative}:{line}"
                )

    if merge_markers:
        print()
        print("Nicht aufgelöste Merge-Marker:")

        for entry in merge_markers:
            print(f"  {entry}")

        fail(
            "Nicht aufgelöste Merge-Marker gefunden."
        )

    if debugger_statements:
        print()
        print("debugger-Anweisungen:")

        for entry in debugger_statements:
            print(f"  {entry}")

        fail(
            "JavaScript-debugger-Anweisungen gefunden."
        )

    print()
    print(
        "console.log/debug/trace:",
        len(debug_console),
    )

    for entry in debug_console:
        print(
            f"  HINWEIS: {entry}"
        )

    print(
        "OK: Keine Merge-Marker oder "
        "debugger-Anweisungen gefunden."
    )


def check_built_assets() -> None:
    expected = [
        ROOT / "js/nc_bitwarden-main.mjs",
        ROOT / "css/nc_bitwarden-main.css",
    ]

    invalid = [
        str(path.relative_to(ROOT))
        for path in expected
        if (
            not path.is_file()
            or path.stat().st_size == 0
        )
    ]

    if invalid:
        fail(
            "Build-Artefakte fehlen oder "
            "sind leer: "
            + ", ".join(invalid)
        )

    print(
        "OK: Produktions-Artefakte vorhanden."
    )


def main() -> int:
    print("=" * 78)
    print("WARDEN RELEASE-PREFLIGHT")
    print("=" * 78)

    check_required_files()
    check_app_identity_architecture()
    check_versions()
    check_routes()

    paths = source_files()

    check_php_syntax(paths)
    check_source_integrity(paths)

    if "--after-build" in sys.argv:
        print()
        check_built_assets()

    print()
    print(
        "Release-Preflight erfolgreich."
    )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
