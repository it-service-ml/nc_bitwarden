export const DEFAULT_USER_PREFERENCES = Object.freeze({
  start_category: 'all',
  interface_mode: 'advanced',
  navigation_start_mode: 'last_used',
  default_target_mode: 'personal',
  default_organization_id: '',
  default_collection_id: '',
  default_item_type: '1',
  last_item_type: 1,
  last_organization_id: '',
  last_collection_id: '',
  generator_mode: 'password',
  password_length: 24,
  password_use_lowercase: true,
  password_use_uppercase: true,
  password_use_digits: true,
  password_use_symbols: true,
  password_exclude_ambiguous: true,
  passphrase_language: 'de',
  passphrase_word_count: 5,
  passphrase_separator: 'hyphen',
  passphrase_capitalization: 'first',
  passphrase_include_number: true,
  passphrase_include_symbol: false,
})

const START_CATEGORIES = new Set([
  'all',
  'favorites',
  'logins',
  'totp',
  'ssh-keys',
  'notes',
  'cards',
  'identities',
])

const INTERFACE_MODES = new Set([
  'standard',
  'advanced',
])

const NAVIGATION_MODES = new Set([
  'last_used',
  'collapsed',
  'personal_expanded',
  'collections_expanded',
  'expanded',
])

const TARGET_MODES = new Set([
  'personal',
  'last_used',
  'fixed',
])

const ITEM_TYPES = new Set([
  '1',
  '2',
  '3',
  '4',
  '5',
  'last_used',
])

const GENERATOR_MODES = new Set([
  'password',
  'passphrase',
])

const PASSPHRASE_LANGUAGES = new Set([
  'de',
  'en',
])

const PASSPHRASE_SEPARATORS = new Set([
  'hyphen',
  'space',
  'dot',
  'underscore',
])

const PASSPHRASE_CAPITALIZATIONS = new Set([
  'lower',
  'first',
  'all',
])

function enumValue(value, allowed, fallback) {
  return allowed.has(String(value))
    ? String(value)
    : fallback
}

function integerValue(value, minimum, maximum, fallback) {
  const parsed = Number.parseInt(value, 10)

  if (!Number.isFinite(parsed)) {
    return fallback
  }

  return Math.max(minimum, Math.min(maximum, parsed))
}

function booleanValue(value, fallback) {
  return typeof value === 'boolean'
    ? value
    : fallback
}

function stringValue(value) {
  return typeof value === 'string'
    ? value.trim().slice(0, 200)
    : ''
}

export function normalizeUserPreferences(value = {}) {
  const source = value && typeof value === 'object'
    ? value
    : {}

  const lastItemType = integerValue(
    source.last_item_type,
    1,
    5,
    DEFAULT_USER_PREFERENCES.last_item_type,
  )

  return {
    start_category: enumValue(
      source.start_category,
      START_CATEGORIES,
      DEFAULT_USER_PREFERENCES.start_category,
    ),
    interface_mode: enumValue(
      source.interface_mode,
      INTERFACE_MODES,
      DEFAULT_USER_PREFERENCES.interface_mode,
    ),
    navigation_start_mode: enumValue(
      source.navigation_start_mode,
      NAVIGATION_MODES,
      DEFAULT_USER_PREFERENCES.navigation_start_mode,
    ),
    default_target_mode: enumValue(
      source.default_target_mode,
      TARGET_MODES,
      DEFAULT_USER_PREFERENCES.default_target_mode,
    ),
    default_organization_id: stringValue(
      source.default_organization_id,
    ),
    default_collection_id: stringValue(
      source.default_collection_id,
    ),
    default_item_type: enumValue(
      source.default_item_type,
      ITEM_TYPES,
      DEFAULT_USER_PREFERENCES.default_item_type,
    ),
    last_item_type: lastItemType,
    last_organization_id: stringValue(
      source.last_organization_id,
    ),
    last_collection_id: stringValue(
      source.last_collection_id,
    ),
    generator_mode: enumValue(
      source.generator_mode,
      GENERATOR_MODES,
      DEFAULT_USER_PREFERENCES.generator_mode,
    ),
    password_length: integerValue(
      source.password_length,
      8,
      128,
      DEFAULT_USER_PREFERENCES.password_length,
    ),
    password_use_lowercase: booleanValue(
      source.password_use_lowercase,
      DEFAULT_USER_PREFERENCES.password_use_lowercase,
    ),
    password_use_uppercase: booleanValue(
      source.password_use_uppercase,
      DEFAULT_USER_PREFERENCES.password_use_uppercase,
    ),
    password_use_digits: booleanValue(
      source.password_use_digits,
      DEFAULT_USER_PREFERENCES.password_use_digits,
    ),
    password_use_symbols: booleanValue(
      source.password_use_symbols,
      DEFAULT_USER_PREFERENCES.password_use_symbols,
    ),
    password_exclude_ambiguous: booleanValue(
      source.password_exclude_ambiguous,
      DEFAULT_USER_PREFERENCES.password_exclude_ambiguous,
    ),
    passphrase_language: enumValue(
      source.passphrase_language,
      PASSPHRASE_LANGUAGES,
      DEFAULT_USER_PREFERENCES.passphrase_language,
    ),
    passphrase_word_count: integerValue(
      source.passphrase_word_count,
      4,
      8,
      DEFAULT_USER_PREFERENCES.passphrase_word_count,
    ),
    passphrase_separator: enumValue(
      source.passphrase_separator,
      PASSPHRASE_SEPARATORS,
      DEFAULT_USER_PREFERENCES.passphrase_separator,
    ),
    passphrase_capitalization: enumValue(
      source.passphrase_capitalization,
      PASSPHRASE_CAPITALIZATIONS,
      DEFAULT_USER_PREFERENCES.passphrase_capitalization,
    ),
    passphrase_include_number: booleanValue(
      source.passphrase_include_number,
      DEFAULT_USER_PREFERENCES.passphrase_include_number,
    ),
    passphrase_include_symbol: booleanValue(
      source.passphrase_include_symbol,
      DEFAULT_USER_PREFERENCES.passphrase_include_symbol,
    ),
  }
}
