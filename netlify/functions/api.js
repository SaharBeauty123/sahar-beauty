const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'content-encoding',
  'content-length',
  'host',
  'origin',
  'transfer-encoding'
]);

function getUpstreamPath(event) {
  const functionPrefix = '/.netlify/functions/api';
  const requestPath = String(event.path || '');

  if (requestPath.startsWith(functionPrefix)) {
    return requestPath.slice(functionPrefix.length).replace(/^\/?/, '/');
  }

  return requestPath.replace(/^\/api\/?/, '/');
}

exports.handler = async (event) => {
  const backendUrl = String(process.env.BACKEND_API_URL || '').replace(/\/+$/, '');

  if (!backendUrl) {
    return {
      statusCode: 500,
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ error: 'BACKEND_API_URL is not configured in Netlify' })
    };
  }

  let query = '';
  try {
    query = new URL(event.rawUrl).search;
  } catch {
    const params = new URLSearchParams(event.queryStringParameters || {});
    query = params.size > 0 ? `?${params.toString()}` : '';
  }
  const targetUrl = `${backendUrl}/api${getUpstreamPath(event)}${query}`;
  const headers = {};

  for (const [name, value] of Object.entries(event.headers || {})) {
    if (!HOP_BY_HOP_HEADERS.has(name.toLowerCase()) && value !== undefined) {
      headers[name] = value;
    }
  }

  const hasBody = !['GET', 'HEAD'].includes(event.httpMethod);
  const body = hasBody && event.body
    ? (event.isBase64Encoded ? Buffer.from(event.body, 'base64') : event.body)
    : undefined;

  try {
    const response = await fetch(targetUrl, {
      method: event.httpMethod,
      headers,
      body,
      redirect: 'manual'
    });
    const responseHeaders = {};

    response.headers.forEach((value, name) => {
      if (!HOP_BY_HOP_HEADERS.has(name.toLowerCase())) {
        responseHeaders[name] = value;
      }
    });

    return {
      statusCode: response.status,
      headers: responseHeaders,
      body: await response.text()
    };
  } catch (error) {
    return {
      statusCode: 502,
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        error: 'The Sahar Beauty backend is unavailable',
        detail: error.message
      })
    };
  }
};
