async function writeClipboard(value) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value)
      return true
    } catch {
      // Use the legacy fallback below.
    }
  }

  const textarea = document.createElement('textarea')

  textarea.value = value
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.top = '-1000px'
  textarea.style.left = '-1000px'
  textarea.style.opacity = '0'
  textarea.style.pointerEvents = 'none'

  document.body.appendChild(textarea)
  textarea.select()
  textarea.setSelectionRange(
    0,
    textarea.value.length,
  )

  const copied = document.execCommand('copy')

  textarea.remove()

  if (!copied) {
    throw new Error('Clipboard write failed')
  }

  return true
}

export async function copySensitiveText(value) {
  const normalizedValue = String(value ?? '')

  if (!normalizedValue) {
    return false
  }

  await writeClipboard(normalizedValue)

  return true
}
