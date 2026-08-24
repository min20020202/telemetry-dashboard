const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

module.exports = async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'GET 요청만 지원합니다.' });
  }

  const videoId = String(request.query?.id || '').trim();
  if (!VIDEO_ID_PATTERN.test(videoId)) {
    return response.status(400).json({ error: '올바른 YouTube 영상 ID가 아닙니다.' });
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return response.status(503).json({ error: 'YouTube API가 아직 설정되지 않았습니다.' });
  }

  try {
    const url = new URL('https://www.googleapis.com/youtube/v3/videos');
    url.searchParams.set('part', 'snippet');
    url.searchParams.set('id', videoId);
    url.searchParams.set('key', apiKey);
    const youtubeResponse = await fetch(url, { headers: { Accept: 'application/json' } });
    const payload = await youtubeResponse.json();

    if (!youtubeResponse.ok) {
      const reason = payload?.error?.message || 'YouTube 영상 정보를 조회하지 못했습니다.';
      return response.status(youtubeResponse.status).json({ error: reason });
    }

    const snippet = payload?.items?.[0]?.snippet;
    if (!snippet) {
      return response.status(404).json({ error: '공개 또는 일부 공개 영상을 찾지 못했습니다.' });
    }

    response.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=3600');
    return response.status(200).json({
      videoId,
      title: String(snippet.title || ''),
      description: String(snippet.description || '')
    });
  } catch (_) {
    return response.status(502).json({ error: 'YouTube 서버와 통신하지 못했습니다.' });
  }
};
