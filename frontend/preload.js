
window.addEventListener('DOMContentLoaded', () => {
  const replaceText = (selector, text) => {
    const element = document.getElementById(selector)
    if (element) element.innerText = text
  }

  for (const type of ['chrome', 'node', 'electron']) {
    replaceText(`${type}-version`, process.versions[type])
  }

  // Communicate with backend
  fetch('http://localhost:8000/')
    .then(response => response.json())
    .then(data => {
      replaceText('backend-message', data.message)
    })
    .catch(error => {
      console.error('Error fetching from backend:', error)
      replaceText('backend-message', 'Error connecting to backend')
    })
})
