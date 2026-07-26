# Changelog

All notable changes to Warden are documented in this file.

## 2.1.0 - 2026-07-26

Version 2.1.0 adds administrator-controlled passkey-based vault unlock after
Vaultwarden OIDC single sign-on.

### Added

- WebAuthn-PRF capability test for compatible browsers and security keys
- Security-key enrollment from an unlocked Warden vault
- Passkey-based vault unlock following successful OIDC SSO
- Replacement and removal of the configured security key
- Administrator policy for enabling passkey-based vault unlock
- Master-password fallback and recovery path

### Security

- Passkey unlock is disabled by default
- Enrollment and unlock are permitted only when enabled by an administrator
- The WebAuthn PRF result remains exclusively in the browser
- The 64-byte Vaultwarden user key is wrapped using AES-256-GCM
- The wrapping key is derived using WebAuthn PRF and HKDF-SHA256
- Credential and account metadata are authenticated as AES-GCM additional data
- The configuration is bound to the selected provider and normalized account
  email address
- Nextcloud stores only the encrypted user key, credential identifier and
  public wrapping metadata
- Existing encrypted configurations remain stored while the administrator
  disables the feature

### Current scope

- Passkey unlock is available after Vaultwarden OIDC SSO
- Classic login remains dependent on the master password
- One passkey-unlock credential is supported per Nextcloud user
- Replacing the security key invalidates the previous configuration
- The master password remains the fallback and recovery method

### Validation

- WebAuthn PRF was tested successfully with a physical security key
- Security-key enrollment was tested from an unlocked vault
- Logout, OIDC SSO and passkey-based unlock were tested successfully
- Personal vault, organization vault and collection decryption were verified
- Administrator enable and disable behavior requires final regression testing
- ESLint, production build and PHP syntax checks passed

## 2.0.2 - 2026-07-25

Version 2.0.2 hardens provider network access and refreshes the JavaScript
dependency tree following the final security review.

### Security

- Disabled redirects for server-side provider API requests
- Disabled redirects for SSO token and profile requests
- User-selected self-hosted providers must resolve only to public,
  non-reserved addresses
- Administrator-defined inherited providers may continue to use trusted
  internal DNS
- Provider URLs containing credentials, query parameters or fragments are
  rejected
- Refreshed vulnerable transitive JavaScript dependencies
- Added separate security gates for production and development dependencies

### Validation

- npm registry signatures checked
- Production dependency audit checked
- Complete dependency tree audit checked
- ESLint and production build checked
- PHP syntax and application metadata checked

## 2.0.1 - 2026-07-25

Version 2.0.1 corrects functional, security and documentation issues found
during the post-release review of 2.0.0.

### Fixed

- Login items now support creating, editing, preserving and deleting multiple
  URLs without discarding all URLs after the first one
- URL match detection settings are preserved and can be edited
- URL match detection is hidden behind an advanced control by default
- Search now covers common decrypted item metadata instead of only item names
- Removed the obsolete server-side `clipboard_timeout` user preference
- Replaced visible hard-coded German labels in the item form and search scope
  with translatable strings
- Corrected the AIO installation instructions so development dependencies are
  not copied into the Nextcloud container

### Security

- Attachment download URLs must use HTTPS
- External attachment download hosts are resolved and rejected when they
  point to private or reserved addresses
- Literal IP addresses, embedded credentials and private hostname suffixes are
  rejected for attachment downloads
- Redirects are disabled for server-side attachment file downloads
- Search intentionally excludes passwords, TOTP secrets, SSH private keys and
  hidden custom-field values
- Documented the tab-scoped storage of decrypted user keys in
  `sessionStorage`

### Changed

- Clarified that Warden SSO currently targets self-hosted Vaultwarden
- Clarified the scope of SSO-only mode
- Clarified attachment direct-upload limitations
- Clarified self-hosted server URL restrictions
- Clarified that passkey support covers display, preservation and removal of
  stored credential metadata
- Clarified that password strength is a basic indicator and password age can
  be estimated for legacy entries

## 2.0.0 - 2026-07-25

Version 2.0.0 is a major expansion of the original Nextcloud integration.

### Added

- OIDC single sign-on for compatible Bitwarden and Vaultwarden servers
- Optional SSO-only login mode
- Initial master-password setup for eligible SSO accounts
- Tab-scoped vault unlock and session restoration
- Vaultwarden TOTP two-step login
- Personal and organization vault navigation
- Complete organization-key decryption using RSA-OAEP
- Organization collection creation, editing, deletion and search
- Personal folder creation, editing and deletion
- Transfer of personal items into organization collections
- Client-side re-encryption during ownership transfers
- Drag-and-drop operations for folders and collections
- Multiple selection and bulk actions
- Encrypted attachment upload, download and deletion
- Configurable maximum attachment size
- Passkey-aware login item display and preservation
- SSH-key item support
- Browser-side SSH-key generation
- Standalone password and passphrase generator
- German and English passphrase generation
- Live TOTP display with current and next code
- Favorites, TOTP, SSH-key and trash categories
- Trash, restore and permanent deletion
- Inline note editing
- Password strength and password age indicators
- Reused-password detection
- Warning for unencrypted HTTP login URLs
- Password history with the five most recently replaced passwords
- Administrator provider defaults and provider enforcement
- Per-user provider, navigation and generator preferences
- Organization notices and configurable support contact
- Three-column responsive Nextcloud interface
- Detail, security and attachment tabs
- German localization

### Changed

- Reworked the complete vault navigation and search interface
- Reworked item detail and item editing views
- Reworked organization and collection handling
- Reworked provider-specific Bitwarden and Vaultwarden terminology
- Improved large-vault navigation and selection behavior
- Improved collection filtering after item changes
- Improved validation and error handling for provider API responses
- Updated compatibility to Nextcloud 31 through 34
- Updated the application version to 2.0.0

### Security

- Vault encryption and decryption remain browser-side
- Master passwords are not transmitted to the Nextcloud server
- Organization keys are decrypted in the browser
- Attachments are encrypted and decrypted in the browser
- Personal-to-organization transfers re-encrypt cipher data before upload
- Access tokens are retained in the server-side PHP session
- New clipboard values are never overwritten by Warden after copying

### Removed

- Removed delayed automatic clipboard clearing

  Browsers block delayed clipboard access when the Warden document is no
  longer focused. The setting could therefore not provide reliable security
  and has been removed.

### Fixed

- Organization cipher updates retain the organization ID
- Collection assignments remain consistent after saving
- Selected entries remain visible after filter changes
- Provider API error statuses are forwarded correctly
- Vaultwarden client version headers are sent correctly
- Empty encrypted values no longer interrupt complete vault loading
- Individual malformed fields no longer prevent other item fields from loading
- Organization ciphers consistently use the organization key
- TOTP login prompts are displayed correctly
- Search clearing and organization selection behave consistently
- Moving entries preserves attachments, passkeys and custom fields
- Old generated CSS and JavaScript chunks are no longer retained in releases
- Frontend source now passes the configured ESLint rules

## 1.1.0

### Added

- Organization collection navigation, search and management
- Personal folder management
- Secure browser-side password generator
- Standalone password generator dialog
- Live TOTP display with current and next code
- Automatic TOTP refresh and countdown
- Dedicated TOTP category
- Copy support for current and next TOTP codes
- Improved card-based entry detail view
- URL opening in a new browser tab
- Tab-scoped vault unlock
- Vaultwarden two-factor login support

### Fixed

- Organization cipher updates retain the organization ID
- Vaultwarden API error statuses are forwarded correctly
- Collection filtering resets consistently after saving
- Selected entries remain visible after filter changes
- Bitwarden client version header is sent to Vaultwarden
