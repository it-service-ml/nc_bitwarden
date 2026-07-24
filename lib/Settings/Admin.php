<?php

namespace OCA\NcBitwarden\Settings;

use OCA\NcBitwarden\AppInfo\Application;
use OCP\AppFramework\Http\TemplateResponse;
use OCP\Settings\ISettings;
use OCP\Util;

final class Admin implements ISettings {
	public function getForm(): TemplateResponse {
		Util::addScript(
			Application::APP_ID,
			'nc_bitwarden-admin-settings',
		);
		Util::addStyle(
			Application::APP_ID,
			'nc_bitwarden-admin-settings',
		);

		return new TemplateResponse(
			Application::APP_ID,
			'admin-settings',
		);
	}

	public function getSection(): string {
		return Application::APP_ID;
	}

	public function getPriority(): int {
		return 10;
	}
}
