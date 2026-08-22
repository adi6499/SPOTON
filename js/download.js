// ========================================
// MusicFlow — Download Manager
// ========================================

const Download = (() => {
  /**
   * Download a song as MP3
   * @param {Object} song - Normalized song object
   * @param {string} quality - Preferred quality
   */
  async function downloadSong(song, quality = '320kbps') {
    try {
      let url = song.streamUrl;

      // If no stream URL, try to fetch it
      if (!url) {
        const details = await API.getSongDetails(song.id);
        if (details && details.length > 0) {
          url = API.getDownloadUrl(details[0], quality);
        }
      }

      if (!url) {
        UI.showToast('Download URL not available', 'error');
        return;
      }

      UI.showToast(`Downloading "${song.name}"...`, 'info');

      // Create filename
      const filename = sanitizeFilename(`${song.name} - ${song.artists}.mp3`);

      // Try fetch + blob approach for proper download
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Fetch failed');

        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
        UI.showToast(`Downloaded "${song.name}"`, 'success');
      } catch {
        // Fallback: direct link download
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        UI.showToast(`Download started for "${song.name}"`, 'success');
      }
    } catch (error) {
      console.error('[Download] Error:', error);
      UI.showToast('Download failed. Try again.', 'error');
    }
  }

  /**
   * Sanitize filename for download
   */
  function sanitizeFilename(name) {
    return name.replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, ' ').trim();
  }

  return { downloadSong };
})();

window.Download = Download;
