<?php


namespace OCA\NcBitwarden\Service;

use OCP\Http\Client\IClientService;
use OCP\ISession;

final class VaultwardenProxyService {
	private const SESSION_TOKEN_KEY = 'bw_access_token';
	private const SESSION_REFRESH_KEY = 'bw_refresh_token';
	private const SESSION_EXPIRY_KEY = 'bw_token_expiry';

	private array $baseOptions = [
		'allow_redirects' => true,
		'timeout' => 15,
		'connect_timeout' => 10,
	];

	private const CLIENT_VERSION = '2026.7.0';

	private function clientHeaders(array $headers = []): array {
		return array_merge(
			[
				'Bitwarden-Client-Version' => self::CLIENT_VERSION,
			],
			$headers,
		);
	}

	public function __construct(
		private IClientService $httpClientService,
		private ISession $session,
		private UserSettingsService $settingsService,
	) {
	}

	/**
	 * Prelogin: KDF-Parameter abrufen
	 * Endpunkt seit Nov 2022: POST {identity}/accounts/prelogin
	 */
	public function prelogin(string $userId, string $email): array {
		$urls = $this->settingsService->getApiUrls($userId);
		$client = $this->httpClientService->newClient();
		try {
			$response = $client->post(
				$urls['identity'] . '/accounts/prelogin',
				array_merge($this->baseOptions, [
					'json' => ['email' => $email],
					'headers' => $this->clientHeaders([
						'Content-Type' => 'application/json',
					]),
				])
			);
			$data = json_decode($this->responseBodyToString($response->getBody()), true);
			if (!is_array($data)) {
				throw new \RuntimeException('Ungueltiger Server-Response (kein JSON)');
			}
			return $data;
		} catch (\Exception $e) {
			throw new \RuntimeException($this->extractErrorMessage($e), 0, $e);
		}
	}

	/**
	 * Login: POST {identity}/connect/token  (OAuth2 Password Grant)
	 */
	public function login(string $userId, array $credentials): array {
		$urls = $this->settingsService->getApiUrls($userId);
		$settings = $this->settingsService->getSettings($userId);
		$client = $this->httpClientService->newClient();
		$formParams = [
			'grant_type' => 'password',
			'username' => $credentials['email'],
			'password' => $credentials['passwordHash'],
			'scope' => 'api offline_access',
			'client_id' => 'web',
			'deviceType' => 10,
			'deviceIdentifier' => $settings['device_id'],
			'deviceName' => 'Nextcloud Bitwarden App',
		];

		if (!empty($credentials['twoFactorToken'])) {
			$formParams['twoFactorProvider'] = (int)($credentials['twoFactorProvider'] ?? 0);
			$formParams['twoFactorToken'] = $credentials['twoFactorToken'];
			$formParams['twoFactorRemember'] = !empty($credentials['twoFactorRemember']) ? '1' : '0';
		}

		try {
			$response = $client->post(
				$urls['identity'] . '/connect/token',
				array_merge($this->baseOptions, [
					'headers' => $this->clientHeaders(),
					'form_params' => $formParams,
				])
			);
		} catch (\Exception $e) {
			if (method_exists($e, 'getResponse') && ($resp = $e->getResponse()) !== null) {
				$body = json_decode($this->responseBodyToString($resp->getBody()), true);

				if (is_array($body)) {
					$customResponse = $body['CustomResponse']
						?? $body['customResponse']
						?? [];

					$providers = $body['TwoFactorProviders']
						?? $body['twoFactorProviders']
						?? $customResponse['TwoFactorProviders']
						?? $customResponse['twoFactorProviders']
						?? null;

					if (is_array($providers)) {
						return [
							'twoFactorRequired' => true,
							'twoFactorProviders' => array_map('intval', $providers),
							'error' => $body['error'] ?? 'invalid_grant',
							'error_description' => $body['error_description']
								?? 'Two factor required.',
						];
					}
				}
			}

			throw new \RuntimeException($this->extractErrorMessage($e), 0, $e);
		}
		$data = json_decode($this->responseBodyToString($response->getBody()), true);
		if (empty($data['access_token'])) {
			throw new \RuntimeException(
				$data['error_description'] ?? $data['error'] ?? 'Login fehlgeschlagen'
			);
		}
		$this->session->set(self::SESSION_TOKEN_KEY, $data['access_token']);
		$this->session->set(self::SESSION_EXPIRY_KEY, time() + ($data['expires_in'] ?? 3600));
		if (!empty($data['refresh_token'])) {
			$this->session->set(self::SESSION_REFRESH_KEY, $data['refresh_token']);
		}
		return $data;
	}

	public function refreshToken(string $userId): void {
		$refreshToken = $this->session->get(self::SESSION_REFRESH_KEY);
		if (!$refreshToken) {
			throw new \RuntimeException('Kein Refresh-Token – bitte erneut einloggen.');
		}
		$urls = $this->settingsService->getApiUrls($userId);
		$client = $this->httpClientService->newClient();
		try {
			$response = $client->post(
				$urls['identity'] . '/connect/token',
				array_merge($this->baseOptions, [
					'headers' => $this->clientHeaders(),
					'form_params' => [
						'grant_type' => 'refresh_token',
						'refresh_token' => $refreshToken,
						'client_id' => 'web',
					],
				])
			);
		} catch (\Exception $e) {
			throw new \RuntimeException($this->extractErrorMessage($e), 0, $e);
		}
		$data = json_decode($this->responseBodyToString($response->getBody()), true);
		$this->session->set(self::SESSION_TOKEN_KEY, $data['access_token']);
		$this->session->set(self::SESSION_EXPIRY_KEY, time() + ($data['expires_in'] ?? 3600));
	}

	/**
	 * Vault-API: GET/POST/PUT/DELETE {api}/...
	 */
	public function apiRequest(string $userId, string $method, string $path, array $body = []): array {
		$this->ensureValidToken($userId);
		$urls = $this->settingsService->getApiUrls($userId);
		$token = $this->session->get(self::SESSION_TOKEN_KEY);
		$client = $this->httpClientService->newClient();
		$options = array_merge($this->baseOptions, [
			'headers' => $this->clientHeaders([
				'Authorization' => 'Bearer ' . $token,
				'Content-Type' => 'application/json',
			]),
		]);
		if (!empty($body)) {
			$options['json'] = $body;
		}
		try {
			$response = match(strtoupper($method)) {
				'GET' => $client->get($urls['api'] . $path, $options),
				'POST' => $client->post($urls['api'] . $path, $options),
				'PUT' => $client->put($urls['api'] . $path, $options),
				'DELETE' => $client->delete($urls['api'] . $path, $options),
				default => throw new \InvalidArgumentException("Unbekannte HTTP-Methode: $method"),
			};
		} catch (\Exception $e) {
			$status = 502;

			if (
				method_exists($e, 'getResponse')
				&& ($errorResponse = $e->getResponse()) !== null
			) {
				$upstreamStatus
					= (int)$errorResponse->getStatusCode();

				if (
					$upstreamStatus >= 400
					&& $upstreamStatus <= 599
				) {
					$status = $upstreamStatus;
				}
			}

			throw new \RuntimeException(
				$this->extractErrorMessage($e),
				$status,
				$e,
			);
		}
		$responseBody = $this->responseBodyToString(
			$response->getBody()
		);

		return $responseBody !== ''
			? (json_decode($responseBody, true) ?? [])
			: [];
	}


	/**
	 * Lädt bereits im Browser verschlüsselte Anhangsdaten hoch.
	 */
	public function uploadAttachment(
		string $userId,
		string $cipherId,
		string $attachmentId,
		string $temporaryPath,
		string $encryptedFileName,
	): array {
		$this->ensureValidToken($userId);

		$urls = $this->settingsService->getApiUrls($userId);
		$token = $this->session->get(self::SESSION_TOKEN_KEY);
		$client = $this->httpClientService->newClient();
		$handle = fopen($temporaryPath, 'rb');

		if ($handle === false) {
			throw new \RuntimeException(
				'Die verschlüsselte Upload-Datei konnte nicht geöffnet werden.',
			);
		}

		$options = array_merge(
			$this->baseOptions,
			[
				'timeout' => 300,
				'connect_timeout' => 20,
				'headers' => $this->clientHeaders([
					'Authorization' => 'Bearer ' . $token,
				]),
				'multipart' => [
					[
						'name' => 'data',
						'contents' => $handle,
						'filename' => $encryptedFileName ?: 'data',
						'headers' => [
							'Content-Type'
								=> 'application/octet-stream',
						],
					],
				],
			],
		);

		try {
			$response = $client->post(
				$urls['api']
				. "/ciphers/$cipherId"
				. "/attachment/$attachmentId",
				$options,
			);
		} catch (\Exception $e) {
			throw $this->wrappedApiException($e);
		} finally {
			if (is_resource($handle)) {
				fclose($handle);
			}
		}

		$responseBody = $this->responseBodyToString(
			$response->getBody(),
		);

		return $responseBody !== ''
			? (json_decode($responseBody, true) ?? [])
			: [];
	}

	/**
	 * Lädt ausschließlich die verschlüsselten Binärdaten herunter.
	 */
	public function downloadAttachment(
		string $userId,
		string $cipherId,
		string $attachmentId,
	): string {
		$this->ensureValidToken($userId);

		$urls = $this->settingsService->getApiUrls($userId);
		$token = $this->session->get(self::SESSION_TOKEN_KEY);
		$client = $this->httpClientService->newClient();

		/*
		 * Vaultwardens Attachment-Endpoint liefert zunächst
		 * Metadaten als JSON. Darin steht die URL zur wirklich
		 * verschlüsselten Binärdatei.
		 */
		$metadataOptions = array_merge(
			$this->baseOptions,
			[
				'timeout' => 60,
				'connect_timeout' => 20,
				'headers' => $this->clientHeaders([
					'Authorization' => 'Bearer ' . $token,
					'Accept' => 'application/json',
				]),
			],
		);

		$metadataUrl = $urls['api']
			. "/ciphers/$cipherId"
			. "/attachment/$attachmentId";

		try {
			$metadataResponse = $client->get(
				$metadataUrl,
				$metadataOptions,
			);
		} catch (\Exception $e) {
			throw $this->wrappedApiException($e);
		}

		$metadataBody = $this->responseBodyToString(
			$metadataResponse->getBody(),
		);

		$metadata = json_decode(
			$metadataBody,
			true,
		);

		$downloadUrl = is_array($metadata)
			? (
				$metadata['url']
				?? $metadata['Url']
				?? null
			)
			: null;

		if (
			!is_string($downloadUrl)
			|| trim($downloadUrl) === ''
		) {
			throw new \RuntimeException(
				'Vaultwarden hat keine Download-URL '
					. 'für den Anhang zurückgegeben.',
				502,
			);
		}

		$downloadUrl = trim($downloadUrl);

		/*
		 * Aktuelle Vaultwarden-Versionen liefern normalerweise
		 * eine absolute URL. Relative URLs werden vorsorglich
		 * gegen den API-Host aufgelöst.
		 */
		if (str_starts_with($downloadUrl, '/')) {
			$apiParts = parse_url($urls['api']);

			$scheme = $apiParts['scheme'] ?? null;
			$host = $apiParts['host'] ?? null;
			$port = isset($apiParts['port'])
				? ':' . $apiParts['port']
				: '';

			if (!$scheme || !$host) {
				throw new \RuntimeException(
					'Die Vaultwarden-API-Adresse '
						. 'ist ungültig.',
					502,
				);
			}

			$downloadUrl =
				$scheme
				. '://'
				. $host
				. $port
				. $downloadUrl;
		}

		$downloadScheme = strtolower(
			(string)parse_url(
				$downloadUrl,
				PHP_URL_SCHEME,
			),
		);

		if ($downloadScheme !== 'https') {
			throw new \RuntimeException(
				'The attachment download URL must use HTTPS.',
				502,
			);
		}

		$this->assertSafeDownloadUrl($downloadUrl, $urls['api']);

		/*
		 * Für diese URL keine Authorization mitsenden:
		 *
		 * - lokales Vaultwarden nutzt einen Download-Token
		 *   in der URL;
		 * - externe Objektspeicher nutzen eine signierte URL.
		 */
		$downloadOptions = array_merge(
			$this->baseOptions,
			[
				'timeout' => 300,
				'connect_timeout' => 20,
				'allow_redirects' => false,
			],
		);

		try {
			$fileResponse = $client->get(
				$downloadUrl,
				$downloadOptions,
			);
		} catch (\Exception $e) {
			throw $this->wrappedApiException($e);
		}

		$statusCode = (int)$fileResponse->getStatusCode();

		if ($statusCode >= 300 && $statusCode <= 399) {
			throw new \RuntimeException(
				'Attachment download redirects are not allowed.',
				502,
			);
		}

		return $this->responseBodyToString(
			$fileResponse->getBody(),
		);
	}

	private function assertSafeDownloadUrl(
		string $url,
		string $providerApiUrl,
	): void {
		$parts = parse_url($url);
		$providerParts = parse_url($providerApiUrl);

		if (
			$parts === false
			|| strtolower((string)($parts['scheme'] ?? ''))
				!== 'https'
			|| empty($parts['host'])
			|| isset($parts['user'])
			|| isset($parts['pass'])
		) {
			throw new \RuntimeException(
				'The attachment download URL is invalid.',
				502,
			);
		}

		if (
			$providerParts === false
			|| empty($providerParts['host'])
		) {
			throw new \RuntimeException(
				'The configured provider URL is invalid.',
				502,
			);
		}

		$host = strtolower(
			rtrim((string)$parts['host'], '.'),
		);

		$providerHost = strtolower(
			rtrim(
				(string)$providerParts['host'],
				'.',
			),
		);

		$isProviderHost = hash_equals(
			$providerHost,
			$host,
		);

		if (
			filter_var(
				$host,
				FILTER_VALIDATE_IP,
			) !== false
			&& !$isProviderHost
		) {
			throw new \RuntimeException(
				'IP addresses are not allowed in external attachment download URLs.',
				502,
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
			] as $blockedSuffix
		) {
			if (
				!$isProviderHost
				&& (
					$host === ltrim(
						$blockedSuffix,
						'.',
					)
					|| str_ends_with(
						$host,
						$blockedSuffix,
					)
				)
			) {
				throw new \RuntimeException(
					'Private external attachment download hosts are not allowed.',
					502,
				);
			}
		}

		$addresses = [];

		$records = @dns_get_record(
			$host,
			DNS_A | DNS_AAAA,
		);

		if (is_array($records)) {
			foreach ($records as $record) {
				$address = $record['ip']
					?? $record['ipv6']
					?? null;

				if (is_string($address)) {
					$addresses[] = $address;
				}
			}
		}

		if ($addresses === []) {
			$ipv4Addresses = @gethostbynamel(
				$host,
			);

			if (is_array($ipv4Addresses)) {
				$addresses = $ipv4Addresses;
			}
		}

		if ($addresses === []) {
			throw new \RuntimeException(
				'The attachment download host could not be resolved.',
				502,
			);
		}

		/*
		 * The configured provider host is already an explicitly
		 * selected server. External storage hosts must additionally
		 * resolve only to public addresses.
		 */
		if ($isProviderHost) {
			return;
		}

		foreach (array_unique($addresses) as $address) {
			if (
				filter_var(
					$address,
					FILTER_VALIDATE_IP,
					FILTER_FLAG_NO_PRIV_RANGE
						| FILTER_FLAG_NO_RES_RANGE,
				) === false
			) {
				throw new \RuntimeException(
					'The external attachment download host resolves to a private or reserved address.',
					502,
				);
			}
		}
	}

	private function wrappedApiException(
		\Exception $exception,
	): \RuntimeException {
		$status = 502;

		if (
			method_exists($exception, 'getResponse')
			&& ($response = $exception->getResponse()) !== null
		) {
			$upstreamStatus = (int)$response->getStatusCode();

			if (
				$upstreamStatus >= 400
				&& $upstreamStatus <= 599
			) {
				$status = $upstreamStatus;
			}
		}

		return new \RuntimeException(
			$this->extractErrorMessage($exception),
			$status,
			$exception,
		);
	}

	private function ensureValidToken(string $userId): void {
		$expiry = (int)($this->session->get(self::SESSION_EXPIRY_KEY) ?? 0);
		if (time() >= ($expiry - 60)) {
			$this->refreshToken($userId);
		}
	}

	/**
	 * Convert a Nextcloud HTTP response body into a string.
	 *
	 * @param mixed $body
	 */
	private function responseBodyToString(mixed $body): string {
		if (is_resource($body)) {
			$contents = stream_get_contents($body);

			return $contents === false ? '' : $contents;
		}

		return is_string($body) ? $body : '';
	}

	private function extractErrorMessage(\Exception $e): string {
		if (method_exists($e, 'getResponse') && ($resp = $e->getResponse()) !== null) {
			$bodyStr = $this->responseBodyToString($resp->getBody());
			$data = json_decode($bodyStr, true);
			if (isset($data['error_description'])) {
				return $data['error_description'];
			}
			if (isset($data['message'])) {
				return $data['message'];
			}
			if (isset($data['error'])) {
				return $data['error'];
			}
			if ($resp->getStatusCode() === 404) {
				return 'API-Endpunkt nicht gefunden (404) – URL in den Einstellungen pruefen';
			}
		}
		return $e->getMessage();
	}
}
