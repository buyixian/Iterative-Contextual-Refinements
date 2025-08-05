const http = require('http');
const https = require('https');
const { URL } = require('url');

/**
 * A generic CORS proxy server.
 *
 * This server listens for incoming requests and forwards them to a target URL
 * specified in the request path.
 *
 * How it works:
 * 1. The server expects the target URL to be appended to its own address.
 *    For example, to proxy a request to `https://api.example.com/data`,
 *    a client would make a request to:
 *    `http://localhost:3000/https://api.example.com/data`
 *
 * 2. The server extracts the target URL from the request's path.
 *
 * 3. It sets up CORS headers to allow cross-origin requests. This is crucial
 *    for web applications running on a different domain than the target API.
 *
 * 4. It forwards the original request (including method, headers, and body)
 *    to the extracted target URL.
 *
 * 5. It pipes the response from the target server back to the original client,
 *    stripping out any problematic hop-by-hop headers.
 */
const server = http.createServer(async (req, res) => {
    // Set CORS headers to allow requests from any origin
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS, PUT, DELETE, PATCH');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Handle pre-flight CORS requests
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // The actual target URL is expected to be the path of the request, without the leading '/'
    const targetUrlString = req.url.slice(1);

    if (!targetUrlString) {
        res.writeHead(400);
        res.end('Proxy Error: Target URL not specified in the path.');
        return;
    }

    try {
        const targetUrl = new URL(targetUrlString);

        const chunks = [];
        req.on('data', chunk => {
            chunks.push(chunk);
        });

        req.on('end', async () => {
            const body = Buffer.concat(chunks);

            const options = {
                hostname: targetUrl.hostname,
                path: targetUrl.pathname + targetUrl.search,
                method: req.method,
                headers: {
                    ...req.headers,
                    'host': targetUrl.hostname, // Set the host header to the target's hostname
                    'Authorization': req.headers['authorization'] || '',
                    'Content-Length': body.length
                },
            };

            const protocol = targetUrl.protocol === 'https:' ? https : http;

            const proxyReq = protocol.request(options, (proxyRes) => {
                const newHeaders = { ...proxyRes.headers };
                // Filter out hop-by-hop headers
                delete newHeaders['content-encoding'];
                delete newHeaders['content-length'];
                delete newHeaders['transfer-encoding'];
                delete newHeaders['connection'];

                res.writeHead(proxyRes.statusCode, newHeaders);
                proxyRes.pipe(res, { end: true });
            });

            proxyReq.on('error', (e) => {
                console.error(`[PROXY] Problem with request to ${targetUrlString}: ${e.message}`);
                res.writeHead(502); // Bad Gateway
                res.end(`Proxy Error: ${e.message}`);
            });

            proxyReq.write(body);
            proxyReq.end();
        });

    } catch (error) {
        console.error(`[PROXY] Invalid target URL: ${targetUrlString}`, error);
        res.writeHead(400);
        res.end(`Proxy Error: Invalid target URL specified.`);
    }
});

const PORT = 3001;
server.listen(PORT, () => {
    console.log(`[PROXY] Generic CORS Proxy server running on http://localhost:${PORT}`);
    console.log(`[PROXY] Usage: http://localhost:${PORT}/<target_url>`);
});