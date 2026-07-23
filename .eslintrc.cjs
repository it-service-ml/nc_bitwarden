module.exports = {
  extends: [
    '@nextcloud/eslint-config/vue3',
  ],

  rules: {
    // Das bestehende Projekt verwendet zwei Leerzeichen statt Tabs.
    indent: [
      'error',
      2,
      {
        SwitchCase: 1,
      },
    ],

    'vue/html-indent': [
      'error',
      2,
    ],

    // Mehrzeilige Vue-Tags werden im Projekt bewusst so formatiert.
    'vue/first-attribute-linebreak': [
      'error',
      {
        singleline: 'beside',
        multiline: 'below',
      },
    ],

    'vue/html-closing-bracket-newline': [
      'error',
      {
        singleline: 'never',
        multiline: 'always',
      },
    ],

    'vue/singleline-html-element-content-newline': 'off',

    // Vorhandener Umbruchstil bei längeren Ausdrücken.
    'operator-linebreak': 'off',

    // JSDoc nicht für jede interne Hilfsfunktion erzwingen.
    'jsdoc/require-jsdoc': 'off',
    'jsdoc/require-param': 'off',
    'jsdoc/check-types': 'off',

    // Vue-Events werden bereits konsistent in kebab-case verwendet.
    'vue/custom-event-name-casing': [
      'warn',
      'kebab-case',
    ],

    // Optionale Vue-Props müssen nicht künstlich Defaultwerte erhalten.
    'vue/require-default-prop': 'off',
  },
}
