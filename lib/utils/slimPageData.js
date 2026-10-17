import { isExport } from '@/lib/utils/buildMode'

/**
 * 体积优化：静态导出时，不把全站导航/链接列表塞进每个页面。
 * 默认开启；需要关闭时，在 BUILD_ENV 里写 SLIM_PAGE_DATA=false
 * 保留哪些字段在这个文件里调整，不会让 Notion 缓存换分区。
 */
export function slimGlobalData(data, { includeInnerLinkPages = false } = {}) {
  if (!data || !isExport() || process.env.SLIM_PAGE_DATA === 'false') {
    return data
  }
  data.allNavPages = []
  data.allLinkPages = includeInnerLinkPages
    ? (data.allLinkPages || []).map(p => ({
        short_id: p.short_id,
        href: p.href
      }))
    : []
  return data
}
