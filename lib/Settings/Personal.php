<?php

namespace OCA\NcBitwarden\Settings;

use OCA\NcBitwarden\AppInfo\AppConstants;
use OCP\AppFramework\Http\TemplateResponse;
use OCP\Settings\ISettings;
use OCP\Util;

final class Personal implements ISettings {
	public function getForm(): TemplateResponse {
		Util::addScript(AppConstants::APP_ID, 'nc_bitwarden-settings');
		Util::addStyle(AppConstants::APP_ID, 'nc_bitwarden-settings');
		return new TemplateResponse(AppConstants::APP_ID, 'settings');
	}
	public function getSection(): string {
		return AppConstants::APP_ID;
	}
	public function getPriority(): int {
		return 10;
	}
}
