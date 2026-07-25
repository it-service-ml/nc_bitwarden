# Changelog

All notable changes to Warden are documented in this file.

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
