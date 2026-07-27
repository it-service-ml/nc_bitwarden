<?php

declare(strict_types=1);

namespace OCA\NcBitwarden\AppInfo;

/**
 * Statische Anwendungsmetadaten ohne Nextcloud-Bootstrap-Logik.
 */
final class AppConstants {
	public const APP_ID = 'nc_bitwarden';

	private function __construct() {
	}
}
