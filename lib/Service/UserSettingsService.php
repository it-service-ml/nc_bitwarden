<?php

namespace OCA\NcBitwarden\Service;

use OCP\IConfig;
use OCP\IL10N;

final class UserSettingsService {
	private const SERVER_TYPE_KEY = 'server_type';
	private const CUSTOM_URL_KEY = 'custom_url';
	private const DEVICE_ID_KEY = 'device_identifier';

	private const DEFAULT_SERVER_TYPE_KEY = 'default_server_type';
	private const DEFAULT_CUSTOM_URL_KEY = 'default_custom_url';
	private const ALLOW_USER_OVERRIDE_KEY = 'allow_user_override';

	private const SERVER_TYPES = [
		'cloud_us',
		'cloud_eu',
		'selfhosted',
	];

	public function __construct(
		private IConfig $config,
		private IL10N $l,
		private string $appName,
	) {
	}

	public function getAdminSettings(): array {
		$serverType = $this->config->getAppValue(
			$this->appName,
			self::DEFAULT_SERVER_TYPE_KEY,
			'cloud_us',
		);

		if (!in_array($serverType, self::SERVER_TYPES, true)) {
			$serverType = 'cloud_us';
		}

		return [
			'server_type' => $serverType,
			'custom_url' => $this->config->getAppValue(
				$this->appName,
				self::DEFAULT_CUSTOM_URL_KEY,
				'',
			),
			'allow_user_override' => $this->config->getAppValue(
				$this->appName,
				self::ALLOW_USER_OVERRIDE_KEY,
				'1',
			) !== '0',
		];
	}

	public function saveAdminSettings(
		string $serverType,
		string $customUrl,
		bool $allowUserOverride,
	): void {
		$customUrl = $this->normalizeCustomUrl($customUrl);

		$this->validateProviderSettings(
			$serverType,
			$customUrl,
		);

		$this->config->setAppValue(
			$this->appName,
			self::DEFAULT_SERVER_TYPE_KEY,
			$serverType,
		);
		$this->config->setAppValue(
			$this->appName,
			self::DEFAULT_CUSTOM_URL_KEY,
			$customUrl,
		);
		$this->config->setAppValue(
			$this->appName,
			self::ALLOW_USER_OVERRIDE_KEY,
			$allowUserOverride ? '1' : '0',
		);
	}

	public function getSettings(string $userId): array {
		$provider = $this->resolveProviderSettings($userId);

		return [
			'server_type' => $provider['server_type'],
			'custom_url' => $provider['custom_url'],
			'device_id' => $this->getOrCreateDeviceId($userId),
			'can_edit' => $provider['can_edit'],
			'inherited' => $provider['inherited'],
		];
	}

	public function saveSettings(
		string $userId,
		string $serverType,
		string $customUrl,
	): void {
		$adminSettings = $this->getAdminSettings();

		if (!$adminSettings['allow_user_override']) {
			throw new \InvalidArgumentException(
				$this->l->t(
					'User-specific server settings are disabled by the administrator',
				),
			);
		}

		$customUrl = $this->normalizeCustomUrl($customUrl);

		$this->validateProviderSettings(
			$serverType,
			$customUrl,
		);

		$this->config->setUserValue(
			$userId,
			$this->appName,
			self::SERVER_TYPE_KEY,
			$serverType,
		);
		$this->config->setUserValue(
			$userId,
			$this->appName,
			self::CUSTOM_URL_KEY,
			$customUrl,
		);
	}

	public function getApiUrls(string $userId): array {
		$settings = $this->resolveProviderSettings($userId);
		$type = $settings['server_type'];
		$customUrl = $settings['custom_url'];

		return match ($type) {
			'cloud_us' => [
				'api' => 'https://api.bitwarden.com',
				'identity' => 'https://identity.bitwarden.com',
			],
			'cloud_eu' => [
				'api' => 'https://api.bitwarden.eu',
				'identity' => 'https://identity.bitwarden.eu',
			],
			'selfhosted' => [
				'api' => $customUrl . '/api',
				'identity' => $customUrl . '/identity',
			],
			default => throw new \RuntimeException(
				$this->l->t('Unknown server type'),
			),
		};
	}

	private function resolveProviderSettings(string $userId): array {
		$adminSettings = $this->getAdminSettings();
		$canEdit = $adminSettings['allow_user_override'];

		if (!$canEdit) {
			return [
				'server_type' => $adminSettings['server_type'],
				'custom_url' => $adminSettings['custom_url'],
				'can_edit' => false,
				'inherited' => true,
			];
		}

		$userServerType = $this->config->getUserValue(
			$userId,
			$this->appName,
			self::SERVER_TYPE_KEY,
			'',
		);

		if (!in_array($userServerType, self::SERVER_TYPES, true)) {
			return [
				'server_type' => $adminSettings['server_type'],
				'custom_url' => $adminSettings['custom_url'],
				'can_edit' => true,
				'inherited' => true,
			];
		}

		return [
			'server_type' => $userServerType,
			'custom_url' => $this->config->getUserValue(
				$userId,
				$this->appName,
				self::CUSTOM_URL_KEY,
				'',
			),
			'can_edit' => true,
			'inherited' => false,
		];
	}

	private function normalizeCustomUrl(string $customUrl): string {
		return rtrim(trim($customUrl), '/');
	}

	private function validateProviderSettings(
		string $serverType,
		string $customUrl,
	): void {
		if (!in_array($serverType, self::SERVER_TYPES, true)) {
			throw new \InvalidArgumentException(
				$this->l->t('Invalid server type'),
			);
		}

		if ($serverType !== 'selfhosted') {
			return;
		}

		$this->validateSelfhostedUrl($customUrl);
	}

	private function validateSelfhostedUrl(string $url): void {
		if (!filter_var($url, FILTER_VALIDATE_URL)) {
			throw new \InvalidArgumentException(
				$this->l->t('Invalid URL'),
			);
		}

		$parsed = parse_url($url);

		if (
			$parsed === false
			|| !isset($parsed['scheme'], $parsed['host'])
		) {
			throw new \InvalidArgumentException(
				$this->l->t('URL could not be parsed'),
			);
		}

		if (strtolower($parsed['scheme']) !== 'https') {
			throw new \InvalidArgumentException(
				$this->l->t('Only HTTPS URLs are allowed'),
			);
		}

		$host = strtolower($parsed['host']);

		if (filter_var($host, FILTER_VALIDATE_IP)) {
			throw new \InvalidArgumentException(
				$this->l->t(
					'IP addresses are not allowed; use a hostname',
				),
			);
		}

		foreach (
			[
				'localhost',
				'.local',
				'.internal',
				'.lan',
				'.corp',
				'.home',
			] as $pattern
		) {
			if (
				$host === ltrim($pattern, '.')
				|| str_ends_with($host, $pattern)
			) {
				throw new \InvalidArgumentException(
					$this->l->t(
						'Internal hostnames are not allowed: {host}',
						['host' => $host],
					),
				);
			}
		}
	}

	private function getOrCreateDeviceId(string $userId): string {
		$id = $this->config->getUserValue(
			$userId,
			$this->appName,
			self::DEVICE_ID_KEY,
			'',
		);

		if ($id === '') {
			$id = $this->generateUuidV4();

			$this->config->setUserValue(
				$userId,
				$this->appName,
				self::DEVICE_ID_KEY,
				$id,
			);
		}

		return $id;
	}

	private function generateUuidV4(): string {
		$bytes = random_bytes(16);
		$bytes[6] = chr(ord($bytes[6]) & 0x0f | 0x40);
		$bytes[8] = chr(ord($bytes[8]) & 0x3f | 0x80);
		$hex = bin2hex($bytes);

		return sprintf(
			'%s-%s-%s-%s-%s',
			substr($hex, 0, 8),
			substr($hex, 8, 4),
			substr($hex, 12, 4),
			substr($hex, 16, 4),
			substr($hex, 20, 12),
		);
	}
}
