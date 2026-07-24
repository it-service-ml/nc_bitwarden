<?php

return [
	'routes' => [
		['name' => 'page#index', 'url' => '/', 'verb' => 'GET'],

		['name' => 'vaultwarden_api#prelogin',    'url' => '/api/prelogin',      'verb' => 'POST'],
		['name' => 'vaultwarden_api#login',        'url' => '/api/login',         'verb' => 'POST'],
		['name' => 'vaultwarden_api#refresh',      'url' => '/api/refresh',       'verb' => 'POST'],
		['name' => 'vaultwarden_api#sync',         'url' => '/api/sync',          'verb' => 'GET'],
		['name' => 'vaultwarden_api#getCiphers',   'url' => '/api/ciphers',       'verb' => 'GET'],
		['name' => 'vaultwarden_api#createCipher',              'url' => '/api/ciphers',                  'verb' => 'POST'],
		['name' => 'vaultwarden_api#createOrganizationCipher',  'url' => '/api/ciphers/create',           'verb' => 'POST'],
		['name' => 'vaultwarden_api#updateCipherCollections',   'url' => '/api/ciphers/{id}/collections', 'verb' => 'POST'],
		['name' => 'vaultwarden_api#updateCipher',              'url' => '/api/ciphers/{id}',             'verb' => 'PUT'],
		['name' => 'vaultwarden_api#deleteCipher', 'url' => '/api/ciphers/{id}',  'verb' => 'DELETE'],
		['name' => 'vaultwarden_api#getFolders',   'url' => '/api/folders',       'verb' => 'GET'],
		['name' => 'vaultwarden_api#createFolder', 'url' => '/api/folders',       'verb' => 'POST'],
		['name' => 'vaultwarden_api#updateFolderPost',   'url' => '/api/folders/{id}',        'verb' => 'POST'],
		['name' => 'vaultwarden_api#updateFolderPut',    'url' => '/api/folders/{id}',        'verb' => 'PUT'],
		['name' => 'vaultwarden_api#deleteFolderPost',   'url' => '/api/folders/{id}/delete', 'verb' => 'POST'],
		['name' => 'vaultwarden_api#deleteFolderDelete', 'url' => '/api/folders/{id}',        'verb' => 'DELETE'],

		['name' => 'vaultwarden_api#getCollectionDetails',    'url' => '/api/organizations/{organizationId}/collections/{collectionId}/details', 'verb' => 'GET'],
		['name' => 'vaultwarden_api#createCollection',        'url' => '/api/organizations/{organizationId}/collections',                        'verb' => 'POST'],
		['name' => 'vaultwarden_api#updateCollectionPost',    'url' => '/api/organizations/{organizationId}/collections/{collectionId}',         'verb' => 'POST'],
		['name' => 'vaultwarden_api#updateCollectionPut',     'url' => '/api/organizations/{organizationId}/collections/{collectionId}',         'verb' => 'PUT'],
		['name' => 'vaultwarden_api#deleteCollectionPost',    'url' => '/api/organizations/{organizationId}/collections/{collectionId}/delete',  'verb' => 'POST'],
		['name' => 'vaultwarden_api#deleteCollectionDelete',  'url' => '/api/organizations/{organizationId}/collections/{collectionId}',         'verb' => 'DELETE'],

		['name' => 'admin_settings#getSettings',  'url' => '/admin-settings', 'verb' => 'GET'],
		['name' => 'admin_settings#saveSettings', 'url' => '/admin-settings', 'verb' => 'POST'],

		['name' => 'settings#getSettings',  'url' => '/settings', 'verb' => 'GET'],
		['name' => 'settings#saveSettings', 'url' => '/settings', 'verb' => 'POST'],
	],
];
