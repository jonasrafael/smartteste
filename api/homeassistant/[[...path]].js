import { createProxyMiddleware } from 'http-proxy-middleware'

export default createProxyMiddleware({
  router(req) {
    const region = req.query.region || 'eu'
    const targetUrl = `https://px1.tuya${region}.com/homeassistant`
    console.log(`[Proxy] Routing request to: ${targetUrl}`)
    return targetUrl
  },
  changeOrigin: true,
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
        body = Buffer.concat(body).toString()
        console.log(`[Proxy] Response from Tuya API (Status: ${proxyRes.statusCode}): ${body}`)
      })
    },
    error(err, req, res) {
      console.error(`[Proxy] Error during proxy request: ${err.message}`)
      res.writeHead(500, {
        'Content-Type': 'text/plain',
      })
      res.end('Proxy Error: ' + err.message)
    },
  }
})


