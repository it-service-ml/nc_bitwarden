<?php

namespace OCA\NcBitwarden\Settings;

use OCA\NcBitwarden\AppInfo\AppConstants;
use OCP\IL10N;
use OCP\IURLGenerator;
use OCP\Settings\IIconSection;

final class AdminSection implements IIconSection {
	public function __construct(
		private IL10N $l,
		private IURLGenerator $urlGenerator,
	) {
	}

	public function getID(): string {
		return AppConstants::APP_ID;
	}

	public function getName(): string {
		return $this->l->t('Warden');
	}

	public function getPriority(): int {
		return 75;
	}

	public function getIcon(): string {
		return $this->urlGenerator->imagePath(
			AppConstants::APP_ID,
			'app.svg',
		);
	}
}
