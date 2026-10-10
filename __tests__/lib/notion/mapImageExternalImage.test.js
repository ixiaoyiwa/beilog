/**
 * @jest-environment node
 */

import { mapImgUrl } from '@/lib/db/notion/mapImage'
import { siteConfig } from '@/lib/config'
import BLOG from '@/blog.config'

// issue 作者站点上被 Referer 防盗链拒绝的 smzdm 外链图
const hotlinkBlockedUrl =
  'https://am.zdmimg.com/202312/05/656f0a6482fbc4851.png_e1080.jpg'

const imageBlock = id => ({
  type: 'image',
  id,
  properties: { source: [['<SOURCE>']] }
})

describe('mapImgUrl 外链图片', () => {
  beforeEach(() => {
    // 关闭随机图替换，聚焦外链转换逻辑
    BLOG.RANDOM_IMAGE_URL = ''
  })

  it('普通外链 image 块走 Notion /image/ 中转，避免源站 Referer 防盗链', () => {
    const block = imageBlock('block-id-1')
    const ret = mapImgUrl(hotlinkBlockedUrl, block, 'block', false)

    expect(ret).toContain(`${BLOG.NOTION_HOST}/image/`)
    expect(ret).toContain(
      encodeURIComponent(hotlinkBlockedUrl)
    )
    expect(ret).toContain('table=block')
    expect(ret).toContain('id=block-id-1')
    // 原始外链不应直接出现（直出会被源站防盗链拒绝）
    expect(ret).not.toContain(hotlinkBlockedUrl)
  })

  it('page 类型封面的外链图同样走中转', () => {
    const block = {
      type: 'page',
      id: 'page-id-1',
      format: { page_cover: hotlinkBlockedUrl }
    }
    const ret = mapImgUrl(hotlinkBlockedUrl, block, 'collection', false)

    expect(ret).toContain(`${BLOG.NOTION_HOST}/image/`)
  })

  it('Notion 自有资源保持原有转换行为', () => {
    const block = imageBlock('block-id-2')
    const secureUrl =
      'https://secure.notion-static.com/abc123/photo.png'
    const ret = mapImgUrl(secureUrl, block, 'block', false)

    expect(ret).toContain(`${BLOG.NOTION_HOST}/image/`)
  })

  it('attachment: 标识保持原有转换行为', () => {
    const block = imageBlock('block-id-3')
    const ret = mapImgUrl(
      'attachment:block-id-3:photo.png',
      block,
      'block',
      false
    )

    expect(ret).toContain(`${BLOG.NOTION_HOST}/image/`)
  })

  it('已转换的反代链接不被二次包装', () => {
    const block = imageBlock('block-id-4')
    const alreadyProxied = `${BLOG.NOTION_HOST}/image/${encodeURIComponent(
      hotlinkBlockedUrl
    )}?table=block&id=block-id-4`
    const ret = mapImgUrl(alreadyProxied, block, 'block', false)

    // 不应出现两层 /image/
    const occurrences = ret.split('/image/').length - 1
    expect(occurrences).toBe(1)
  })

  it('中转链接仍带去重参数 t=<blockId>', () => {
    const block = imageBlock('block-id-5')
    const ret = mapImgUrl(hotlinkBlockedUrl, block, 'block', false)

    expect(ret).toContain('t=block-id-5')
  })

  describe('外链压缩参数（回归：代理前需先做源站压缩）', () => {
    const unsplashUrl = 'https://images.unsplash.com/photo-1234567890'

    it('Unsplash 外链 + block_width 走中转后仍保留 width/q/fmt 参数', () => {
      const block = {
        type: 'image',
        id: 'unsplash-1',
        format: { block_width: 800 }
      }
      const ret = mapImgUrl(unsplashUrl, block, 'block', true)

      // 仍走防盗链中转
      expect(ret).toContain(`${BLOG.NOTION_HOST}/image/`)
      // 被编码进代理地址的源 URL 必须带上压缩参数，否则图片不再被压缩
      const encoded = ret.split('/image/')[1].split('?')[0]
      const source = decodeURIComponent(encoded)
      expect(source).toContain('width=800')
      expect(source).toContain('q=50')
      expect(source).toContain('fmt=webp')
      expect(source).toContain('fm=webp')
    })

    it('没有 block_width 时使用配置的默认压缩宽度', () => {
      const block = { type: 'image', id: 'unsplash-2' }
      const ret = mapImgUrl(unsplashUrl, block, 'block', true)

      const source = decodeURIComponent(ret.split('/image/')[1].split('?')[0])
      expect(source).toContain(`width=${siteConfig('IMAGE_COMPRESS_WIDTH')}`)
    })

    it('非 Unsplash 外链的中转行为不受影响', () => {
      const block = {
        type: 'image',
        id: 'smzdm-1',
        format: { block_width: 800 }
      }
      const ret = mapImgUrl(hotlinkBlockedUrl, block, 'block', true)

      expect(ret).toContain(`${BLOG.NOTION_HOST}/image/`)
      // 非 Unsplash 源站没有已知的压缩参数约定，源 URL 应保持原样
      const source = decodeURIComponent(ret.split('/image/')[1].split('?')[0])
      expect(source).toBe(hotlinkBlockedUrl)
    })

    it('needCompress=false 时不追加压缩参数', () => {
      const block = {
        type: 'image',
        id: 'unsplash-3',
        format: { block_width: 800 }
      }
      const ret = mapImgUrl(unsplashUrl, block, 'block', false)

      const source = decodeURIComponent(ret.split('/image/')[1].split('?')[0])
      expect(source).not.toContain('width=800')
    })
  })
})
