import { createAppConfig } from '@nextcloud/vite-config'

export default createAppConfig(
  {
    main:             'src/main.js',
    settings:         'src/settings.js',
    'admin-settings': 'src/admin-settings.js',
  },
  {
    config: {
      build: { sourcemap: false },
    },
  }
)
