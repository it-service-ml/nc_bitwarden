<?php

namespace OCA\NcBitwarden\Controller;

use OCA\NcBitwarden\Service\UserSettingsService;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http\JSONResponse;
use OCP\IRequest;

final class AdminSettingsController extends Controller {
	public function __construct(
		string $appName,
		IRequest $request,
		private UserSettingsService $settingsService,
	) {
		parent::__construct($appName, $request);
	}

	public function getSettings(): JSONResponse {
		return new JSONResponse(
			$this->settingsService->getAdminSettings(),
		);
	}

	public function saveSettings(): JSONResponse {
		try {
			$allowUserOverride = filter_var(
				$this->request->getParam(
					'allow_user_override',
					true,
				),
				FILTER_VALIDATE_BOOLEAN,
				FILTER_NULL_ON_FAILURE,
			);

			if ($allowUserOverride === null) {
				throw new \InvalidArgumentException(
					'Invalid value for allow_user_override',
				);
			}

			$this->settingsService->saveAdminSettings(
				(string)$this->request->getParam(
					'server_type',
					'cloud_us',
				),
				(string)$this->request->getParam(
					'custom_url',
					'',
				),
				$allowUserOverride,
			);

			return new JSONResponse([
				'status' => 'ok',
			]);
		} catch (\InvalidArgumentException $e) {
			return new JSONResponse(
				['error' => $e->getMessage()],
				400,
			);
		}
	}
}
