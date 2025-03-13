export default async function handler(req, res) {
  const { path } = req.query;
  const backendUrl = process.env.BACKEND_URL || "https://your-railway-app.up.railway.app";
  
  try {
    // Forward the request to Railway
    const response = await fetch(`${backendUrl}/${path.join('/')}`, {
      method: req.method,
      headers: {
        ...req.headers,
        'x-forwarded-host': req.headers.host,
        'x-forwarded-proto': 'https'
      },
      body: req.method !== 'GET' && req.method !== 'HEAD' ? 
            JSON.stringify(req.body) : undefined
    });
    
    // Get the response data
    const data = await response.text();
    
    // Set the appropriate status and headers
    res.status(response.status);
    for (const [key, value] of response.headers.entries()) {
      res.setHeader(key, value);
    }
    
    // Send the response
    res.send(data);
  } catch (error) {
    console.error('Backend proxy error:', error);
    res.status(500).json({ error: 'Failed to reach backend service' });
  }
} 