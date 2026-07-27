<?php

namespace OCA\NcBitwarden\Controller;

use OCA\NcBitwarden\AppInfo\AppConstants;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\Attribute\NoCSRFRequired;
use OCP\AppFramework\Http\TemplateResponse;
use OCP\IRequest;
use OCP\Util;

final class PageController extends Controller {
	public function __construct(IRequest $request) {
		parent::__construct(AppConstants::APP_ID, $request);
	}

	#[NoAdminRequired]
	#[NoCSRFRequired]
	public function index(): TemplateResponse {
		Util::addScript(AppConstants::APP_ID, 'nc_bitwarden-main');
		Util::addStyle(AppConstants::APP_ID, 'nc_bitwarden-main');
		return new TemplateResponse(AppConstants::APP_ID, 'main');
	}
}
