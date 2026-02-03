/**
 * Utils Router
 * Utility API endpoints
 *
 * Routes:
 * GET /api/v1/utils/link-preview - Get Open Graph metadata for a URL
 */

import { Router } from 'express'
import { z } from 'zod'

const router = Router()

// Cache for link previews (in-memory, could use Redis in production)
const previewCache = new Map()
const CACHE_TTL = 1000 * 60 * 60 // 1 hour

/**
 * Extract Open Graph metadata from HTML
 */
function extractOGMetadata(html, url) {
  const metadata = {
    title: null,
    description: null,
    image: null,
    siteName: null,
    favicon: null,
    url: url,
  }

  // Helper to extract meta content
  const getMetaContent = (property) => {
    // Try og: prefix
    const ogMatch = html.match(
      new RegExp(`<meta[^>]*property=["']og:${property}["'][^>]*content=["']([^"']+)["']`, 'i')
    ) || html.match(
      new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:${property}["']`, 'i')
    )
    if (ogMatch) return ogMatch[1]

    // Try twitter: prefix
    const twitterMatch = html.match(
      new RegExp(`<meta[^>]*name=["']twitter:${property}["'][^>]*content=["']([^"']+)["']`, 'i')
    ) || html.match(
      new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*name=["']twitter:${property}["']`, 'i')
    )
    if (twitterMatch) return twitterMatch[1]

    // Try standard meta name
    const nameMatch = html.match(
      new RegExp(`<meta[^>]*name=["']${property}["'][^>]*content=["']([^"']+)["']`, 'i')
    ) || html.match(
      new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*name=["']${property}["']`, 'i')
    )
    if (nameMatch) return nameMatch[1]

    return null
  }

  // Extract title
  metadata.title = getMetaContent('title')
  if (!metadata.title) {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    if (titleMatch) metadata.title = titleMatch[1].trim()
  }

  // Extract description
  metadata.description = getMetaContent('description')

  // Extract image
  metadata.image = getMetaContent('image')
  if (metadata.image && !metadata.image.startsWith('http')) {
    // Make relative URL absolute
    try {
      const urlObj = new URL(url)
      metadata.image = new URL(metadata.image, `${urlObj.protocol}//${urlObj.host}`).href
    } catch {
      // Ignore invalid URLs
    }
  }

  // Extract site name
  metadata.siteName = getMetaContent('site_name')
  if (!metadata.siteName) {
    try {
      const urlObj = new URL(url)
      metadata.siteName = urlObj.hostname.replace('www.', '')
    } catch {
      // Ignore
    }
  }

  // Extract favicon
  const faviconMatch = html.match(
    /<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']+)["']/i
  ) || html.match(
    /<link[^>]*href=["']([^"']+)["'][^>]*rel=["'](?:shortcut )?icon["']/i
  )
  if (faviconMatch) {
    let faviconUrl = faviconMatch[1]
    if (!faviconUrl.startsWith('http')) {
      try {
        const urlObj = new URL(url)
        faviconUrl = new URL(faviconUrl, `${urlObj.protocol}//${urlObj.host}`).href
      } catch {
        // Ignore
      }
    }
    metadata.favicon = faviconUrl
  } else {
    // Default to /favicon.ico
    try {
      const urlObj = new URL(url)
      metadata.favicon = `${urlObj.protocol}//${urlObj.host}/favicon.ico`
    } catch {
      // Ignore
    }
  }

  return metadata
}

/**
 * GET /link-preview
 * Fetch Open Graph metadata for a URL
 */
router.get('/link-preview', async (req, res, next) => {
  try {
    const { url } = req.query

    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_URL',
        message: 'URL parameter is required',
      })
    }

    // Validate URL
    let parsedUrl
    try {
      parsedUrl = new URL(url)
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('Invalid protocol')
      }
    } catch {
      return res.status(400).json({
        success: false,
        error: 'INVALID_URL',
        message: 'Invalid URL provided',
      })
    }

    // Check cache
    const cacheKey = url
    const cached = previewCache.get(cacheKey)
    if (cached && cached.timestamp > Date.now() - CACHE_TTL) {
      return res.json({
        success: true,
        data: cached.data,
        cached: true,
      })
    }

    // Fetch the URL
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000) // 5 second timeout

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; NexoraBot/1.0; +https://nexora.com)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        signal: controller.signal,
        redirect: 'follow',
      })

      clearTimeout(timeout)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const contentType = response.headers.get('content-type') || ''
      if (!contentType.includes('text/html')) {
        // Not HTML, return basic info
        return res.json({
          success: true,
          data: {
            title: parsedUrl.hostname,
            description: null,
            image: null,
            siteName: parsedUrl.hostname,
            favicon: `${parsedUrl.protocol}//${parsedUrl.host}/favicon.ico`,
            url: url,
          },
        })
      }

      // Read only first 50KB to avoid large payloads
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let html = ''
      let bytesRead = 0
      const maxBytes = 50 * 1024

      while (bytesRead < maxBytes) {
        const { done, value } = await reader.read()
        if (done) break

        html += decoder.decode(value, { stream: true })
        bytesRead += value.length

        // Check if we have </head> - no need to read more
        if (html.includes('</head>')) break
      }

      reader.cancel()

      // Extract metadata
      const metadata = extractOGMetadata(html, url)

      // Cache result
      previewCache.set(cacheKey, {
        data: metadata,
        timestamp: Date.now(),
      })

      // Clean old cache entries periodically
      if (previewCache.size > 1000) {
        const now = Date.now()
        for (const [key, value] of previewCache.entries()) {
          if (value.timestamp < now - CACHE_TTL) {
            previewCache.delete(key)
          }
        }
      }

      res.json({
        success: true,
        data: metadata,
      })
    } catch (fetchError) {
      clearTimeout(timeout)

      if (fetchError.name === 'AbortError') {
        return res.status(408).json({
          success: false,
          error: 'TIMEOUT',
          message: 'Request timed out',
        })
      }

      // Return basic fallback
      res.json({
        success: true,
        data: {
          title: parsedUrl.hostname,
          description: null,
          image: null,
          siteName: parsedUrl.hostname,
          favicon: `${parsedUrl.protocol}//${parsedUrl.host}/favicon.ico`,
          url: url,
        },
      })
    }
  } catch (error) {
    next(error)
  }
})

export default router
