# Warden

> Native Bitwarden and Vaultwarden integration for Nextcloud

![Version](https://img.shields.io/badge/Version-2.0.0-blue)
![Nextcloud](https://img.shields.io/badge/Nextcloud-31--34-0082C9?logo=nextcloud&logoColor=white)
![PHP](https://img.shields.io/badge/PHP-8.1+-777BB4?logo=php&logoColor=white)
![License](https://img.shields.io/badge/License-AGPL--3.0-green)

Warden provides access to Bitwarden and Vaultwarden vaults directly inside
Nextcloud.

It supports classic master-password authentication, Vaultwarden TOTP login,
OIDC single sign-on, personal and organization vaults, encrypted attachments,
collections, folders, passkey-aware login entries, SSH keys, password
generation, bulk operations and trash management.

Vault cryptography is performed in the browser. The master password and
decrypted vault contents are not sent to Nextcloud.

Warden is an independent integration and is not an official Bitwarden client.

## Supported providers

Warden can connect to:

- Bitwarden Cloud US at `bitwarden.com`
- Bitwarden Cloud EU at `bitwarden.eu`
- Self-hosted Vaultwarden instances
- Compatible self-hosted Bitwarden instances

Self-hosted servers must provide a valid HTTPS endpoint that is reachable from
the Nextcloud server.

## Features

### Authentication

- Classic email and master-password login
- Vaultwarden TOTP two-step login
- OIDC single sign-on where supported by the selected server
- Optional SSO-only operation
- First-login master-password setup for SSO accounts when required
- Tab-scoped vault unlock
- Provider configuration by administrators
- Optional per-user provider overrides

### Vault items

Warden supports the following Bitwarden item types:

- Login
- Secure note
- Card
- Identity
- SSH key

Login entries support:

- Username and password
- Multiple URLs
- TOTP secrets and live codes
- Password history
- Passkey credential information
- Custom text, hidden, boolean and linked fields

SSH keys can be displayed, edited and generated in the browser.

### Personal and organization vaults

- Personal vault items
- Personal folders
- Organization vaults
- Organization collections
- Collection creation, editing and deletion
- Organization-key decryption using RSA-OAEP
- Moving personal entries into organization collections
- Client-side re-encryption during ownership transfers
- Preservation of attachments, passkeys and custom fields during transfers

### Attachments

- Encrypted attachment upload
- Encrypted attachment download
- Attachment deletion
- Configurable server-side attachment size limit
- Client-side attachment encryption and decryption

### Navigation and management

- Three-column Nextcloud interface
- Personal and organization navigation
- Folder and collection counters
- Full-text search
- Favorites
- TOTP category
- SSH-key category
- Trash view
- Restore from trash
- Permanent deletion
- Drag-and-drop
- Multiple selection
- Bulk folder and collection operations
- Bulk transfer from personal vaults to organizations
- Inline note editing

### Password tools

- Browser-side password generator
- Browser-side passphrase generator
- Configurable length and character groups
- German and English passphrase word lists
- Password strength indication
- Password age indication
- Reused-password detection
- HTTP URL warning
- Storage of the five most recently replaced passwords

### Preferences

Administrators can configure:

- Default provider
- Self-hosted provider URL
- Whether users may override the provider
- Login and SSO behavior
- Maximum attachment size
- Organization notices and support information

Users can configure, where permitted:

- Provider selection
- Initial navigation category
- Navigation expansion behavior
- Default target vault and collection
- Default item type
- Password-generator defaults
- Passphrase-generator defaults

## Security model

Warden separates browser-side cryptography from the Nextcloud API proxy.

```text
Browser                         Nextcloud                     Provider
   │                                │                            │
   │  Authentication request        │                            │
   ├───────────────────────────────▶│───────────────────────────▶│
   │                                │                            │
   │                                │◀──── Encrypted data ──────│
   │◀──── Encrypted vault data ─────│                            │
   │                                │                            │
   │  Key derivation, verification, encryption and decryption   │
   │  take place in the browser.                                │
   │                                │                            │
   │  Plaintext vault contents remain in the browser.           │
```

The implementation includes:

- PBKDF2 and Argon2id key derivation
- HKDF key expansion
- AES-CBC encryption and decryption
- HMAC-SHA256 authentication
- RSA-OAEP organization-key decryption
- Client-side cipher re-encryption
- Client-side attachment encryption and decryption
- Provider access tokens stored in the server-side PHP session

The master password itself is not sent to the Nextcloud server. Classic login
uses values derived from the master password as required by the Bitwarden
protocol.

### Browser memory

JavaScript strings and cryptographic values cannot be guaranteed to be
securely erased from browser memory. This limitation applies to browser-based
password managers in general.

### Clipboard behavior

Warden copies values only after a direct user action.

Warden does not attempt to clear the system clipboard automatically after a
delay. Browsers block delayed clipboard access when the Warden tab is no longer
focused, which would make such a security option unreliable.

Users should treat copied passwords, TOTP codes and private keys as sensitive
clipboard data.

### No offline cache

Warden does not maintain a persistent offline copy of the decrypted vault.

## Authentication modes

### Classic login

Classic login requires the account email address and master password.

When TOTP is enabled on a Vaultwarden account, Warden requests the current
authenticator code after the password has been verified.

Other interactive two-step methods, such as WebAuthn or hardware security
keys, are not currently handled by Warden's classic login form.

### OIDC single sign-on

For servers configured with OIDC SSO, Warden can start and complete the
provider login directly from Nextcloud.

SSO authenticates the user but does not bypass vault encryption. Depending on
the provider and account state, a master password may still be required to
unlock or initialize the encrypted vault.

When the server reports that an SSO account does not yet have a master
password, Warden can guide the user through the initial setup.

An administrator may configure SSO-only operation to prevent use of the
classic Warden login form.

## Requirements

| Component | Requirement |
|---|---|
| Nextcloud | 31, 32, 33 or 34 |
| PHP | 8.1 or newer |
| Browser | Current Chromium, Firefox or Safari with Web Crypto support |
| HTTPS | Required for production operation |
| Node.js | Required only when building from source |
| npm | Required only when building from source |

## Installation

### Install a release package

Extract the application into the Nextcloud application directory:

```bash
cd /var/www/html/custom_apps
tar -xzf nc_bitwarden-2.0.0.tar.gz
chown -R www-data:www-data nc_bitwarden
```

Enable the application:

```bash
sudo -u www-data php /var/www/html/occ app:enable nc_bitwarden
```

### Install from source

```bash
cd /var/www/html/custom_apps

git clone \
  https://github.com/it-service-ml/nc_bitwarden.git

cd nc_bitwarden

npm ci
npm run build

sudo -u www-data php /var/www/html/occ app:enable nc_bitwarden
```

The generated `js/` and `css/` directories are required for operation.

## Upgrade

Replace the application files with the new version and rebuild the frontend
when installing from source:

```bash
cd /var/www/html/custom_apps/nc_bitwarden

npm ci
npm run build
```

Then run the Nextcloud upgrade process:

```bash
sudo -u www-data php /var/www/html/occ upgrade
```

Nextcloud stores the installed application version separately. Running
`occ upgrade` is therefore required after changing the version in
`appinfo/info.xml`.

## Configuration

### Administrator settings

Open:

```text
Nextcloud
└── Administration settings
    └── Warden
```

Select one of the supported providers:

- Bitwarden Cloud US
- Bitwarden Cloud EU
- Self-hosted Vaultwarden or Bitwarden

For a self-hosted provider, enter only the base URL:

```text
https://vault.example.com
```

Do not add `/api`, `/identity` or another API path.

The administrator can enforce this provider for all users or allow individual
provider overrides.

### Personal settings

When provider overrides are permitted, users can select their own provider
under:

```text
Nextcloud
└── Personal settings
    └── Warden server
```

Additional vault and generator preferences are available from the settings
dialog inside Warden.

## Internal and self-hosted servers

When the provider uses an internal address, Nextcloud may need permission to
contact local remote servers:

```bash
sudo -u www-data php /var/www/html/occ \
  config:system:set allow_local_remote_servers \
  --value=true \
  --type=bool
```

Only enable this option when local provider URLs are intentionally required.

### Private certificate authorities

The CA that signed the provider certificate must be trusted by the operating
system and PHP environment used by Nextcloud.

Do not disable TLS certificate verification.

## Nextcloud AIO

Build Warden before copying it into the AIO container because the production
Nextcloud container does not normally contain the Node.js build toolchain.

Example:

```bash
cd nc_bitwarden
npm ci
npm run build

docker cp \
  . \
  nextcloud-aio-nextcloud:/var/www/html/custom_apps/nc_bitwarden

docker exec \
  --user www-data \
  nextcloud-aio-nextcloud \
  php /var/www/html/occ app:enable nc_bitwarden

docker exec \
  --user www-data \
  nextcloud-aio-nextcloud \
  php /var/www/html/occ upgrade
```

Container names may differ between installations.

## Development

Install dependencies:

```bash
npm ci
```

Start the watch build:

```bash
npm run dev
```

Run ESLint:

```bash
npm run lint
```

Create a production build:

```bash
npm run build
```

### Main directories

```text
appinfo/       Nextcloud metadata and routes
lib/           PHP controllers, services and settings
src/           Vue components and browser-side services
templates/     Nextcloud PHP templates
l10n/          Application translations
js/            Generated JavaScript
css/           Generated stylesheets
```

Do not edit generated files in `js/` or `css/` directly.

## Current limitations

Warden does not currently provide:

- Browser autofill
- Bitwarden Send
- Persistent offline vault access
- WebAuthn or hardware-key handling in the classic two-step login form
- Passkey-based login to Warden
- Passkey-based vault unlock
- Guaranteed delayed clearing of the operating-system clipboard

Stored passkey credentials in vault entries are separate from using a passkey
to authenticate to Warden.

## Release checks

Before publishing a release:

```bash
npm run lint
npm run build

find appinfo lib \
  -type f \
  -name '*.php' \
  -print0 \
  | xargs -0 -n1 php -l
```

The application version must match in:

- `appinfo/info.xml`
- `package.json`
- `package-lock.json`

## License

Warden is licensed under the
[GNU Affero General Public License v3.0](LICENSE).

## Credits

Warden is maintained by **Christian Thiele / Mission Leben IT**.

The original Nextcloud application was created by **Philipp Tannich** and was
subsequently extended and modernized by Mission Leben IT.

Related projects:

- [Bitwarden](https://bitwarden.com)
- [Vaultwarden](https://github.com/dani-garcia/vaultwarden)
- [Nextcloud](https://nextcloud.com)
- [@noble/hashes](https://github.com/paulmillr/noble-hashes)
