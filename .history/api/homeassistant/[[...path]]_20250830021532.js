import { createProxyMiddleware } from 'http-proxy-middleware'

export default createProxyMiddleware({
  router(req) {
    const region = req.query.region || 'eu'
    const targetUrl = `https://px1.tuya${region}.com/homeassistant`
    console.log(`[Proxy] Routing request to: ${targetUrl}`)
    return targetUrl
  },
  changeOrigin: true,
  secure: false,
  timeout: 30000,
  pathRewrite: {
    '^/api/homeassistant': '' // strip "/api" from the URL
  },
  on: {
    proxyReq(proxyReq, req, res) {
      console.log(`[Proxy] Requesting: ${proxyReq.protocol}//${proxyReq.host}${proxyReq.path}`)
      
      // Log request body if available
      if (req.body) {
        console.log(`[Proxy] Request Body: ${JSON.stringify(req.body)}`)
      }
      
      const proxyReqUrl = new URL(proxyReq.path, `${proxyReq.protocol}//${proxyReq.host}`)
      proxyReqUrl.searchParams.delete('region')
      proxyReqUrl.searchParams.delete('[...path]')
      proxyReq.path = proxyReqUrl.pathname + proxyReqUrl.search
    },
    proxyRes(proxyRes, req, res) {
      let body = []
      proxyRes.on('data', (chunk) => {
        body.push(chunk)
      })
      proxyRes.on('end', () => {
        try {
          body = Buffer.concat(body).toString()
          console.log(`[Proxy] Response from Tuya API (Status: ${proxyRes.statusCode}): ${body}`)
        } catch (error) {
          console.error(`[Proxy] Error parsing response: ${error.message}`)
        }
      })
    },
    error(err, req, res) {
      console.error(`[Proxy] Error during proxy request: ${err.message}`)
      
      // Check if response has already been sent
      if (!res.headersSent) {
        res.writeHead(500, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        })
        res.end(JSON.stringify({
          error: 'Proxy Error',
          message: err.message,
          code: err.code || 'UNKNOWN_ERROR'
        }))
      }
    }
  }
})


