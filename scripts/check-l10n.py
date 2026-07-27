#!/usr/bin/env python3

from __future__ import annotations

from collections import Counter
from pathlib import Path
import ast
import json
import re
import subprocess
import sys


ROOT = Path(__file__).resolve().parent.parent
APP_ID = "nc_bitwarden"
CATALOG_PATH = ROOT / "l10n/de.php"

SOURCE_EXTENSIONS = {
    ".vue",
    ".js",
    ".ts",
}

SOURCE_ROOT = ROOT / "src"


JS_TRANSLATION_PATTERN = re.compile(
    r"""
    \bt\s*\(
        \s*(['"])nc_bitwarden\1
        \s*,\s*
        (
            '(?:\\.|[^'\\])*'
            |
            "(?:\\.|[^"\\])*"
        )
    """,
    re.VERBOSE | re.DOTALL,
)

JS_TRANSLATION_START_PATTERN = re.compile(
    r"""
    \bt\s*\(
        \s*(['"])nc_bitwarden\1
        \s*,
    """,
    re.VERBOSE | re.DOTALL,
)

BRACE_PLACEHOLDER_PATTERN = re.compile(
    r"\{[A-Za-z_][A-Za-z0-9_.-]*\}"
)

PRINTF_PLACEHOLDER_PATTERN = re.compile(
    r"%(?:\d+\$)?[bcdeEfFgGosuxX]"
)


def fail(message: str) -> None:
    print(
        f"FEHLER: {message}",
        file=sys.stderr,
    )
    raise SystemExit(1)


def load_php_catalog() -> tuple[
    dict[str, str | list[str]],
    str,
]:
    if not CATALOG_PATH.is_file():
        fail(f"{CATALOG_PATH} fehlt.")

    php_code = r"""
$TRANSLATIONS = [];
$PLURAL_FORMS = '';

require $argv[1];

if (!is_array($TRANSLATIONS)) {
    fwrite(STDERR, "\$TRANSLATIONS ist kein Array.\n");
    exit(1);
}

if (!is_string($PLURAL_FORMS)) {
    fwrite(STDERR, "\$PLURAL_FORMS ist kein String.\n");
    exit(1);
}

echo json_encode(
    [
        'translations' => $TRANSLATIONS,
        'pluralForm' => $PLURAL_FORMS,
    ],
    JSON_UNESCAPED_UNICODE
    | JSON_UNESCAPED_SLASHES
    | JSON_THROW_ON_ERROR
);
"""

    result = subprocess.run(
        [
            "php",
            "-r",
            php_code,
            str(CATALOG_PATH),
        ],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )

    if result.returncode != 0:
        print(
            result.stderr,
            file=sys.stderr,
            end="",
        )

        fail(
            "Der PHP-Übersetzungskatalog "
            "konnte nicht geladen werden."
        )

    try:
        data = json.loads(result.stdout)
    except json.JSONDecodeError as exception:
        fail(
            "Die PHP-Ausgabe ist kein gültiges JSON: "
            f"{exception}"
        )

    translations = data.get("translations")
    plural_form = data.get("pluralForm")

    if not isinstance(translations, dict):
        fail(
            "Das Feld translations ist kein Objekt."
        )

    if not isinstance(plural_form, str):
        fail(
            "Das Feld pluralForm ist kein String."
        )

    normalized: dict[
        str,
        str | list[str],
    ] = {}

    for source, translation in translations.items():
        if not isinstance(source, str):
            fail(
                "Ein Übersetzungsschlüssel "
                "ist kein String."
            )

        if isinstance(translation, str):
            normalized[source] = translation
            continue

        if (
            isinstance(translation, list)
            and all(
                isinstance(value, str)
                for value in translation
            )
        ):
            normalized[source] = translation
            continue

        fail(
            "Ungültiger Übersetzungswert für "
            f"{source!r}: "
            f"{type(translation).__name__}"
        )

    return normalized, plural_form


def decode_source_literal(
    literal: str,
) -> str | None:
    try:
        value = ast.literal_eval(literal)
    except (
        SyntaxError,
        ValueError,
    ):
        return None

    return value if isinstance(value, str) else None


def line_number(
    text: str,
    position: int,
) -> int:
    return (
        text.count(
            "\n",
            0,
            position,
        )
        + 1
    )


def placeholder_counter(
    value: str,
) -> Counter[str]:
    placeholders = (
        BRACE_PLACEHOLDER_PATTERN.findall(value)
        + PRINTF_PLACEHOLDER_PATTERN.findall(value)
    )

    return Counter(placeholders)


def translation_values(
    translation: str | list[str],
) -> list[str]:
    if isinstance(translation, str):
        return [translation]

    return translation


def main() -> int:
    translations, plural_form = load_php_catalog()

    if not plural_form.strip():
        fail("Die Pluralregel ist leer.")

    if not SOURCE_ROOT.is_dir():
        fail(f"{SOURCE_ROOT} fehlt.")

    source_files = sorted(
        path
        for path in SOURCE_ROOT.rglob("*")
        if (
            path.is_file()
            and path.suffix in SOURCE_EXTENSIONS
        )
    )

    used: dict[str, list[str]] = {}
    dynamic_calls: list[str] = []
    unreadable_literals: list[str] = []

    for path in source_files:
        text = path.read_text(
            encoding="utf-8",
            errors="strict",
        )

        relative = path.relative_to(ROOT)

        static_matches = list(
            JS_TRANSLATION_PATTERN.finditer(text)
        )

        static_starts = {
            match.start()
            for match in static_matches
        }

        for match in static_matches:
            source = decode_source_literal(
                match.group(2)
            )

            location = (
                f"{relative}:"
                f"{line_number(text, match.start())}"
            )

            if source is None:
                unreadable_literals.append(location)
                continue

            used.setdefault(
                source,
                [],
            ).append(location)

        for match in (
            JS_TRANSLATION_START_PATTERN.finditer(text)
        ):
            if match.start() in static_starts:
                continue

            dynamic_calls.append(
                f"{relative}:"
                f"{line_number(text, match.start())}"
            )

    missing = sorted(
        source
        for source in used
        if source not in translations
    )

    empty: list[str] = []

    for source, translation in translations.items():
        values = translation_values(translation)

        if not values:
            empty.append(source)
            continue

        if any(
            not value.strip()
            for value in values
        ):
            empty.append(source)

    placeholder_errors: list[
        tuple[str, int, Counter[str], Counter[str]]
    ] = []

    for source in sorted(used):
        translation = translations.get(source)

        if translation is None:
            continue

        expected = placeholder_counter(source)

        for index, value in enumerate(
            translation_values(translation)
        ):
            actual = placeholder_counter(value)

            if actual != expected:
                placeholder_errors.append(
                    (
                        source,
                        index,
                        expected,
                        actual,
                    )
                )

    unused = sorted(
        set(translations)
        - set(used)
    )

    unchanged_used = sorted(
        source
        for source in used
        if (
            source in translations
            and isinstance(
                translations[source],
                str,
            )
            and translations[source] == source
        )
    )

    print(
        "Frontend-Dateien geprüft:",
        len(source_files),
    )

    print(
        "Statische Übersetzungsschlüssel:",
        len(used),
    )

    print(
        "Katalogeinträge:",
        len(translations),
    )

    print(
        "Fehlende Übersetzungen:",
        len(missing),
    )

    print(
        "Leere Übersetzungen:",
        len(empty),
    )

    print(
        "Platzhalterfehler:",
        len(placeholder_errors),
    )

    print(
        "Dynamische/nicht statische Aufrufe:",
        len(dynamic_calls),
    )

    print(
        "Nicht lesbare Literale:",
        len(unreadable_literals),
    )

    print(
        "Aktuell nicht im Frontend verwendete "
        "Katalogeinträge:",
        len(unused),
    )

    print(
        "Bewusst oder möglicherweise "
        "unverändert englische Einträge:",
        len(unchanged_used),
    )

    if missing:
        print()
        print("=" * 78)
        print("FEHLENDE ÜBERSETZUNGEN")
        print("=" * 78)

        for source in missing:
            print()
            print(repr(source))

            for location in used[source]:
                print(f"  {location}")

    if empty:
        print()
        print("=" * 78)
        print("LEERE ÜBERSETZUNGEN")
        print("=" * 78)

        for source in empty:
            print(repr(source))

    if placeholder_errors:
        print()
        print("=" * 78)
        print("PLATZHALTERFEHLER")
        print("=" * 78)

        for (
            source,
            index,
            expected,
            actual,
        ) in placeholder_errors:
            print()
            print(repr(source))
            print(
                f"  Übersetzungsvariante: {index}"
            )
            print(
                "  Erwartet:",
                dict(expected),
            )
            print(
                "  Gefunden:",
                dict(actual),
            )

            for location in used.get(source, []):
                print(f"  Quelle: {location}")

    if dynamic_calls:
        print()
        print("=" * 78)
        print("DYNAMISCHE ODER NICHT ANALYSIERTE AUFRUFE")
        print("=" * 78)

        for location in dynamic_calls:
            print(location)

    if unreadable_literals:
        print()
        print("=" * 78)
        print("NICHT LESBARE STRING-LITERALE")
        print("=" * 78)

        for location in unreadable_literals:
            print(location)

    if unchanged_used:
        print()
        print("=" * 78)
        print("UNVERÄNDERT ENGLISCHE VERWENDETE EINTRÄGE")
        print("=" * 78)

        for source in unchanged_used:
            print(repr(source))

    hard_error = bool(
        missing
        or empty
        or placeholder_errors
        or dynamic_calls
        or unreadable_literals
    )

    if hard_error:
        print()
        print(
            "Übersetzungsaudit fehlgeschlagen.",
            file=sys.stderr,
        )

        return 1

    print()
    print(
        "Übersetzungsaudit erfolgreich."
    )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
