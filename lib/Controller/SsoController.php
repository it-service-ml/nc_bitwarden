<?php

declare(strict_types=1);

namespace OCA\NcBitwarden\Controller;

use OCA\NcBitwarden\Service\SsoService;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http\Attribute\BruteForceProtection;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\Attribute\NoCSRFRequired;
use OCP\AppFramework\Http\Attribute\UseSession;
use OCP\AppFramework\Http\JSONResponse;
use OCP\AppFramework\Http\RedirectResponse;
use OCP\IRequest;
use OCP\IURLGenerator;
use Psr\Log\LoggerInterface;

final class SsoController extends Controller {
	public function __construct(
		string $appName,
		IRequest $request,
		private SsoService $ssoService,
		private IURLGenerator $urlGenerator,
		private LoggerInterface $logger,
		private string $userId,
	) {
		parent::__construct($appName, $request);
	}

	#[NoAdminRequired]
	#[UseSession]
	public function start(): JSONResponse {
		try {
			return new JSONResponse([
				'url' => $this->ssoService
					->createAuthorizationUrl(
						$this->userId,
					),
			]);
		} catch (\Exception $e) {
			$this->logger->error(
				'nc_bitwarden: SSO start failed',
				[
					'userId' => $this->userId,
					'error' => $e->getMessage(),
				],
			);

			return new JSONResponse(
				[
					'error'
						=> 'SSO-Anmeldung konnte '
							. 'nicht gestartet werden.',
				],
				500,
			);
		}
	}

	#[NoAdminRequired]
	#[NoCSRFRequired]
	#[UseSession]
	public function callback(): RedirectResponse {
		try {
			$result = $this->ssoService->complete(
				$this->userId,
				(string)$this->request->getParam('code', ''),
				(string)$this->request->getParam('state', ''),
			);

			$status = $result['status'] === 'two_factor_required'
				? 'twofactor'
				: 'complete';

			return new RedirectResponse(
				$this->appUrl(['sso' => $status]),
			);
		} catch (\Exception $e) {
			$this->logger->warning(
				'nc_bitwarden: SSO callback failed',
				[
					'userId' => $this->userId,
					'error' => $e->getMessage(),
				],
			);

			return new RedirectResponse(
				$this->appUrl(['sso' => 'error']),
			);
		}
	}

	#[NoAdminRequired]
	#[UseSession]
	#[BruteForceProtection(action: 'bw_sso_two_factor')]
	public function twoFactor(): JSONResponse {
		try {
			return new JSONResponse(
				$this->ssoService->completeTwoFactor(
					$this->userId,
					(string)$this->request->getParam(
						'twoFactorToken',
						'',
					),
				),
			);
		} catch (\Exception $e) {
			$this->logger->warning(
				'nc_bitwarden: SSO two-factor failed',
				[
					'userId' => $this->userId,
					'error' => $e->getMessage(),
				],
			);

			$response = new JSONResponse(
				['error' => $e->getMessage()],
				401,
			);
			$response->throttle();

			return $response;
		}
	}

	#[NoAdminRequired]
	#[UseSession]
	public function result(): JSONResponse {
		$result = $this->ssoService->consumeResult();

		if ($result === null) {
			return new JSONResponse(
				[
					'error'
						=> 'Kein abgeschlossener SSO-Anmeldevorgang vorhanden.',
				],
				404,
			);
		}

		return new JSONResponse($result);
	}

	private function appUrl(array $query = []): string {
		$url = $this->urlGenerator->linkToRouteAbsolute(
			'nc_bitwarden.page.index',
		);

		if ($query === []) {
			return $url;
		}

		return $url . '?' . http_build_query(
			$query,
			'',
			'&',
			PHP_QUERY_RFC3986,
		);
	}
}
