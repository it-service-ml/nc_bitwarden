import axios from '@nextcloud/axios'
import { generateUrl } from '@nextcloud/router'

const base = (path) => generateUrl(`/apps/nc_bitwarden${path}`)

export const BitwardenApi = {
  async getSettings()              { return (await axios.get(base('/settings'))).data },
  async saveSettings(data)         { return (await axios.post(base('/settings'), data)).data },

  async getCurrentUserProfile() {
    const userId = document.head?.getAttribute('data-user')

    if (!userId) {
      return null
    }

    const response = await axios.get(
      generateUrl(`/ocs/v2.php/cloud/users/${encodeURIComponent(userId)}`),
      {
        headers: {
          'OCS-APIRequest': 'true',
        },
        params: {
          format: 'json',
        },
      },
    )

    return response.data?.ocs?.data ?? null
  },

  async prelogin(email)            { return (await axios.post(base('/api/prelogin'), { email })).data },
  async login(email, passwordHash, twoFactorToken = null) { const data = { email, passwordHash }

		if (twoFactorToken) {
			data.twoFactorProvider = 0
			data.twoFactorToken = twoFactorToken
			data.twoFactorRemember = false
		}

		return (await axios.post(base('/api/login'), data)).data },
  async refresh()                  { return (await axios.post(base('/api/refresh'))).data },

  async sync()                     { return (await axios.get(base('/api/sync'))).data },
  async getCiphers()               { return (await axios.get(base('/api/ciphers'))).data },
  async createCipher(data)         { return (await axios.post(base('/api/ciphers'), data)).data },
  async updateCipher(id, data)     { return (await axios.put(base(`/api/ciphers/${id}`), data)).data },
  async deleteCipher(id)           { return (await axios.delete(base(`/api/ciphers/${id}`))).data },

  async getFolders()               { return (await axios.get(base('/api/folders'))).data },
  async createFolder(data)         { return (await axios.post(base('/api/folders'), data)).data },
  async deleteFolder(id)           { return (await axios.delete(base(`/api/folders/${id}`))).data },
}
