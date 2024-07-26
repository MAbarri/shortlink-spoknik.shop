import type { z } from 'zod'
import { parsePath } from 'ufo'
import type { LinkSchema } from '@/schemas/link'

export default eventHandler(async (event) => {
  const { pathname: complexSlug, search } = parsePath(event.path.slice(1)) // remove leading slash
  const slug = complexSlug.includes("/") ? complexSlug.split("/")[0] : complexSlug;
  const { slugRegex, reserveSlug } = useAppConfig(event)
  const { homeURL } = useRuntimeConfig(event)
  const { cloudflare } = event.context

  if (event.path === '/' && homeURL)
    return sendRedirect(event, homeURL)

  if (slug && !reserveSlug.includes(slug) && slugRegex.test(slug) && cloudflare) {
    const { KV } = cloudflare.env
    const link: z.infer<typeof LinkSchema> | null = await KV.get(`link:${slug}`, { type: 'json' })
    if (link) {
      event.context.link = link
      try {
        await useAccessLog(event)
      }
      catch (error) {
        console.error('Failed write access log:', error)
      }

      // Append the remaining path to the link URL
      const targetUrl = complexSlug.includes("/")
        ? `${link.url}/${complexSlug.substring(complexSlug.indexOf("/") + 1)}`
        : `${link.url}`;


      return sendRedirect(event, targetUrl, +useRuntimeConfig(event).redirectStatusCode)
    }
  }
})
