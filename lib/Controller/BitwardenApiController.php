<?php
namespace OCA\NcBitwarden\Controller;

use OCA\NcBitwarden\Service\BitwardenProxyService;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http\Attribute\BruteForceProtection;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\JSONResponse;
use OCP\IRequest;
use Psr\Log\LoggerInterface;

class BitwardenApiController extends Controller {
    public function __construct(
        string $appName,
        IRequest $request,
        private BitwardenProxyService $proxyService,
        private LoggerInterface $logger,
        private string $userId,
    ) {
        parent::__construct($appName, $request);
    }

    #[NoAdminRequired]
    #[BruteForceProtection(action: 'bw_prelogin')]
    public function prelogin(): JSONResponse {
        try {
            return new JSONResponse($this->proxyService->prelogin(
                $this->userId,
                (string)$this->request->getParam('email', '')
            ));
        } catch (\Exception $e) {
            $this->logger->warning('nc_bitwarden: prelogin failed', [
                'userId' => $this->userId, 'error' => $e->getMessage(),
            ]);
            return new JSONResponse(['error' => $e->getMessage()], 502);
        }
    }

    #[NoAdminRequired]
    #[BruteForceProtection(action: 'bw_login')]
    public function login(): JSONResponse {
        try {
            return new JSONResponse($this->proxyService->login($this->userId, [
                'email'        => (string)$this->request->getParam('email', ''),
                'passwordHash' => (string)$this->request->getParam('passwordHash', ''),
                'twoFactorProvider' => $this->request->getParam('twoFactorProvider'),
                'twoFactorToken' => (string)$this->request->getParam('twoFactorToken', ''),
                'twoFactorRemember' => (bool)$this->request->getParam('twoFactorRemember', false),
            ]));
        } catch (\Exception $e) {
            $this->logger->warning('nc_bitwarden: login failed', [
                'userId' => $this->userId, 'error' => $e->getMessage(),
            ]);
            return new JSONResponse(['error' => $e->getMessage()], 401);
        }
    }

    #[NoAdminRequired]
    public function refresh(): JSONResponse {
        try {
            $this->proxyService->refreshToken($this->userId);
            return new JSONResponse(['status' => 'ok']);
        } catch (\Exception $e) {
            $this->logger->warning('nc_bitwarden: token refresh failed', ['error' => $e->getMessage()]);
            return new JSONResponse(['error' => 'Sitzung abgelaufen – bitte erneut einloggen.'], 401);
        }
    }

    #[NoAdminRequired]
    public function sync(): JSONResponse { return $this->proxy('GET', '/sync?excludeDomains=true'); }

    #[NoAdminRequired]
    public function getCiphers(): JSONResponse { return $this->proxy('GET', '/ciphers'); }

    #[NoAdminRequired]
    public function createCipher(): JSONResponse {
        return $this->proxy(
            'POST',
            '/ciphers',
            $this->getJsonBody()
        );
    }

    #[NoAdminRequired]
    public function createOrganizationCipher(): JSONResponse {
        return $this->proxy(
            'POST',
            '/ciphers/create',
            $this->getJsonBody()
        );
    }

    #[NoAdminRequired]
    public function updateCipherCollections(string $id): JSONResponse {
        return $this->proxy(
            'POST',
            "/ciphers/$id/collections",
            $this->getJsonBody()
        );
    }

    #[NoAdminRequired]
    public function updateCipher(string $id): JSONResponse {
        return $this->proxy(
            'PUT',
            "/ciphers/$id",
            $this->getJsonBody(true)
        );
    }

    #[NoAdminRequired]
    public function deleteCipher(string $id): JSONResponse { return $this->proxy('DELETE', "/ciphers/$id"); }

    #[NoAdminRequired]
    public function getFolders(): JSONResponse { return $this->proxy('GET', '/folders'); }

    #[NoAdminRequired]
    public function createFolder(): JSONResponse { return $this->proxy('POST', '/folders', $this->getJsonBody()); }

    #[NoAdminRequired]
    public function updateFolderPost(string $id): JSONResponse {
        return $this->proxy(
            'POST',
            "/folders/$id",
            $this->getJsonBody()
        );
    }

    #[NoAdminRequired]
    public function updateFolderPut(string $id): JSONResponse {
        return $this->proxy(
            'POST',
            "/folders/$id",
            $this->getJsonBody()
        );
    }

    #[NoAdminRequired]
    public function deleteFolderPost(string $id): JSONResponse {
        return $this->proxy('POST', "/folders/$id/delete");
    }

    #[NoAdminRequired]
    public function deleteFolderDelete(string $id): JSONResponse {
        return $this->proxy('POST', "/folders/$id/delete");
    }

    #[NoAdminRequired]
    public function getCollectionDetails(
        string $organizationId,
        string $collectionId,
    ): JSONResponse {
        return $this->proxy(
            'GET',
            "/organizations/$organizationId/collections/$collectionId/details"
        );
    }

    #[NoAdminRequired]
    public function createCollection(string $organizationId): JSONResponse {
        return $this->proxy(
            'POST',
            "/organizations/$organizationId/collections",
            $this->getJsonBody()
        );
    }

    #[NoAdminRequired]
    public function updateCollectionPost(
        string $organizationId,
        string $collectionId,
    ): JSONResponse {
        return $this->proxy(
            'POST',
            "/organizations/$organizationId/collections/$collectionId",
            $this->getJsonBody()
        );
    }

    #[NoAdminRequired]
    public function updateCollectionPut(
        string $organizationId,
        string $collectionId,
    ): JSONResponse {
        return $this->proxy(
            'POST',
            "/organizations/$organizationId/collections/$collectionId",
            $this->getJsonBody()
        );
    }

    #[NoAdminRequired]
    public function deleteCollectionPost(
        string $organizationId,
        string $collectionId,
    ): JSONResponse {
        return $this->proxy(
            'POST',
            "/organizations/$organizationId/collections/$collectionId/delete"
        );
    }

    #[NoAdminRequired]
    public function deleteCollectionDelete(
        string $organizationId,
        string $collectionId,
    ): JSONResponse {
        return $this->proxy(
            'POST',
            "/organizations/$organizationId/collections/$collectionId/delete"
        );
    }

    private function getJsonBody(
        bool $preserveOrganizationId = false,
    ): array {
        $params = $this->request->getParams();
        $this->request->throwDecodingExceptionIfAny();

        // URL-Parameter dürfen nicht an Vaultwarden weitergereicht werden.
        unset(
            $params['id'],
            $params['collectionId'],
        );

        // Bei Cipher-Updates ist organizationId ein reguläres Payload-Feld.
        if (!$preserveOrganizationId) {
            unset($params['organizationId']);
        }

        return $params;
    }

    private function proxy(string $method, string $path, array $body = []): JSONResponse {
        try {
            return new JSONResponse($this->proxyService->apiRequest($this->userId, $method, $path, $body));
        } catch (\Exception $e) {
            $status = (int)$e->getCode();

            if ($status < 400 || $status > 599) {
                $status = 502;
            }

            $message = $status < 500
                ? ($e->getMessage() ?: 'Vault-Anfrage fehlgeschlagen.')
                : 'Vault-Anfrage fehlgeschlagen.';

            $this->logger->error(
                'nc_bitwarden: API proxy error',
                [
                    'method' => $method,
                    'path' => $path,
                    'status' => $status,
                    'error' => $e->getMessage(),
                ],
            );

            return new JSONResponse(
                ['error' => $message],
                $status,
            );
        }
    }
}
