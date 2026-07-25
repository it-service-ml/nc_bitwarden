import {
  recommendedJavascript,
} from '@nextcloud/eslint-config'
import pluginVue from 'eslint-plugin-vue'

export default [
  {
    name: 'warden/ignores',
    ignores: [
      'css/**',
      'js/**',
      'node_modules/**',
      'vendor/**',
      'vendor-bin/**',
      'l10n/**',
      'build/**',
      'dist/**',
      '.patch-backups/**',
    ],
  },

  ...recommendedJavascript,

  {
    name: 'warden/source-overrides',
    files: [
      'src/**/*.js',
      'src/**/*.vue',
    ],
    plugins: {
      vue: pluginVue,
    },
    rules: {
      /*
       * Warden uses two spaces and deliberately keeps existing readable
       * multiline expressions. These rules affect formatting only.
       */
      '@stylistic/indent': [
        'error',
        2,
        {
          SwitchCase: 1,
          flatTernaryExpressions: false,
          ignoredNodes: [
            'ConditionalExpression *',
          ],
        },
      ],
      'vue/html-indent': [
        'error',
        2,
        {
          attribute: 1,
          baseIndent: 1,
          closeBracket: 0,
          alignAttributesVertically: true,
          ignores: [],
        },
      ],

      /*
       * Vue templates use kebab-case, while JavaScript props remain
       * camelCase.
       */
      'vue/attribute-hyphenation': [
        'error',
        'always',
      ],
      'vue/v-on-event-hyphenation': [
        'error',
        'always',
        {
          autofix: false,
          ignore: [],
          ignoreTags: [],
        },
      ],
      'vue/custom-event-name-casing': [
        'error',
        'kebab-case',
        {
          ignores: [
            '/^update:/u',
          ],
        },
      ],
      'vue/multi-word-component-names': [
        'error',
        {
          ignores: [
            'App',
            'Settings',
          ],
        },
      ],

      /*
       * The following rules enforce formatting or documentation style
       * only. They are intentionally disabled for the existing codebase.
       */
      '@stylistic/function-paren-newline': 'off',
      'vue/html-closing-bracket-newline': 'off',
      'jsdoc/require-jsdoc': 'off',
      '@stylistic/exp-list-style': 'off',
      '@stylistic/arrow-parens': 'off',
      '@stylistic/implicit-arrow-linebreak': 'off',
      '@stylistic/indent-binary-ops': 'off',
      'perfectionist/sort-imports': 'off',
      '@stylistic/operator-linebreak': 'off',
      'curly': 'off',
      'jsdoc/require-param': 'off',
      '@stylistic/max-statements-per-line': 'off',
      'perfectionist/sort-named-imports': 'off',
      '@stylistic/padded-blocks': 'off',
      'vue/operator-linebreak': 'off',
      'jsdoc/check-types': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      '@stylistic/function-call-argument-newline': 'off',
      'vue/comma-dangle': 'off',
      'antfu/top-level-function': 'off',

      /*
       * Correctness, compatibility and security-relevant rules remain
       * active through the Nextcloud configuration.
       */
      'no-console': 'off',
    },
  },
  {
    name: 'warden/password-generator-exceptions',
    files: [
      'src/components/PasswordGenerator.vue',
    ],
    rules: {
      'vue/no-boolean-default': 'off',
    },
  },

  {
    name: 'warden/vault-list-public-api',
    files: [
      'src/components/VaultList.vue',
    ],
    rules: {
      'vue/no-unused-properties': 'off',
    },
  },

]
