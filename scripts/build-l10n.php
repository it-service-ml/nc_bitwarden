<?php

declare(strict_types=1);

/**
 * Erzeugt die Nextcloud-Frontend-Kataloge sicher aus l10n/de.php.
 *
 * Anders als Nextclouds l10n:createjs werden Schlüssel und Werte
 * vollständig mit json_encode() maskiert. Anführungszeichen,
 * Backslashes und Unicode-Zeichen können deshalb den JavaScript-
 * Katalog nicht mehr syntaktisch zerstören.
 */

$appId = 'nc_bitwarden';

$root = dirname(__DIR__);
$l10nDirectory = $root . '/l10n';

$sourcePath = $l10nDirectory . '/de.php';
$jsPath = $l10nDirectory . '/de.js';
$jsonPath = $l10nDirectory . '/de.json';

$checkOnly = in_array(
    '--check',
    $argv,
    true
);

if (!is_file($sourcePath)) {
    fwrite(
        STDERR,
        "Fehler: {$sourcePath} fehlt.\n"
    );
    exit(1);
}

/**
 * @return array{
 *     translations: array<string, string|array>,
 *     pluralForm: string
 * }
 */
function loadTranslations(string $path): array
{
    $TRANSLATIONS = [];
    $PLURAL_FORMS = '';

    require $path;

    if (!is_array($TRANSLATIONS)) {
        throw new RuntimeException(
            '$TRANSLATIONS ist kein Array.'
        );
    }

    if (
        !is_string($PLURAL_FORMS)
        || trim($PLURAL_FORMS) === ''
    ) {
        throw new RuntimeException(
            '$PLURAL_FORMS fehlt oder ist leer.'
        );
    }

    foreach ($TRANSLATIONS as $source => $translation) {
        if (!is_string($source)) {
            throw new RuntimeException(
                'Ein Übersetzungsschlüssel ist kein String.'
            );
        }

        if (is_string($translation)) {
            continue;
        }

        if (!is_array($translation)) {
            throw new RuntimeException(
                sprintf(
                    'Ungültiger Übersetzungswert für %s: %s',
                    var_export($source, true),
                    get_debug_type($translation)
                )
            );
        }

        foreach ($translation as $index => $pluralValue) {
            if (!is_string($pluralValue)) {
                throw new RuntimeException(
                    sprintf(
                        'Ungültiger Pluralwert für %s[%s]: %s',
                        var_export($source, true),
                        (string)$index,
                        get_debug_type($pluralValue)
                    )
                );
            }
        }
    }

    return [
        'translations' => $TRANSLATIONS,
        'pluralForm' => $PLURAL_FORMS,
    ];
}

function jsonEncode(mixed $value, int $additionalFlags = 0): string
{
    return json_encode(
        $value,
        JSON_PRETTY_PRINT
        | JSON_UNESCAPED_UNICODE
        | JSON_UNESCAPED_SLASHES
        | JSON_THROW_ON_ERROR
        | $additionalFlags
    );
}

function atomicWrite(
    string $targetPath,
    string $content
): void {
    $directory = dirname($targetPath);

    $temporaryPath = tempnam(
        $directory,
        '.' . basename($targetPath) . '.'
    );

    if ($temporaryPath === false) {
        throw new RuntimeException(
            "Temporäre Datei für {$targetPath} "
            . 'konnte nicht angelegt werden.'
        );
    }

    try {
        $written = file_put_contents(
            $temporaryPath,
            $content,
            LOCK_EX
        );

        if ($written !== strlen($content)) {
            throw new RuntimeException(
                "Datei {$temporaryPath} wurde nicht "
                . 'vollständig geschrieben.'
            );
        }

        if (!chmod($temporaryPath, 0644)) {
            throw new RuntimeException(
                "Dateirechte für {$temporaryPath} "
                . 'konnten nicht gesetzt werden.'
            );
        }

        if (!rename($temporaryPath, $targetPath)) {
            throw new RuntimeException(
                "{$targetPath} konnte nicht atomar "
                . 'ersetzt werden.'
            );
        }
    } finally {
        if (is_file($temporaryPath)) {
            unlink($temporaryPath);
        }
    }
}

function compareCatalog(
    string $path,
    string $expected
): bool {
    if (!is_file($path)) {
        fwrite(
            STDERR,
            "Fehlt: {$path}\n"
        );

        return false;
    }

    $current = file_get_contents($path);

    if ($current === false) {
        fwrite(
            STDERR,
            "Kann nicht gelesen werden: {$path}\n"
        );

        return false;
    }

    if ($current !== $expected) {
        fwrite(
            STDERR,
            "Nicht aktuell: {$path}\n"
        );

        return false;
    }

    return true;
}

try {
    $catalog = loadTranslations($sourcePath);

    $translations = $catalog['translations'];
    $pluralForm = $catalog['pluralForm'];

    $jsonContent = jsonEncode([
        'translations' => $translations,
        'pluralForm' => $pluralForm,
    ]) . "\n";

    $jsContent = sprintf(
        "OC.L10N.register(\n"
        . "    %s,\n"
        . "    %s,\n"
        . "    %s\n"
        . ");\n",
        jsonEncode($appId),
        jsonEncode($translations),
        jsonEncode($pluralForm)
    );

    if ($checkOnly) {
        $valid = true;

        $valid = compareCatalog(
            $jsPath,
            $jsContent
        ) && $valid;

        $valid = compareCatalog(
            $jsonPath,
            $jsonContent
        ) && $valid;

        if (!$valid) {
            fwrite(
                STDERR,
                "Die Frontend-Kataloge stimmen nicht "
                . "mit de.php überein.\n"
            );

            exit(1);
        }

        printf(
            "OK: de.js und de.json stimmen mit "
            . "de.php überein (%d Einträge).\n",
            count($translations)
        );

        exit(0);
    }

    atomicWrite(
        $jsPath,
        $jsContent
    );

    atomicWrite(
        $jsonPath,
        $jsonContent
    );

    printf(
        "Erzeugt: de.js und de.json "
        . "mit %d Übersetzungen.\n",
        count($translations)
    );
} catch (Throwable $exception) {
    fwrite(
        STDERR,
        "Übersetzungsgenerator fehlgeschlagen:\n"
        . $exception->getMessage()
        . "\n"
    );

    exit(1);
}
