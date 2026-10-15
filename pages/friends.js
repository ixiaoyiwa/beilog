import BLOG from '@/blog.config'
import { siteConfig } from '@/lib/config'
import { fetchGlobalAllData } from '@/lib/db/SiteDataApi'
import { DynamicLayout } from '@/themes/theme'
import { Client } from '@notionhq/client'
import {
  fetchNotionPageBlocks,
  formatNotionBlock
} from '@/lib/db/notion/getPostBlocks'
import { adapterNotionBlockMap } from '@/lib/utils/notion.util'

const FRIENDS_DB_ID = '3e91137a265a80d19b7bca7ee29ae8a1'

const Friends = props => {
  const theme = siteConfig('THEME', BLOG.THEME, props.NOTION_CONFIG)
  return <DynamicLayout theme={theme} layoutName='LayoutFriends' {...props} />
}

export async function getStaticProps({ locale }) {
  const props = await fetchGlobalAllData({ from: 'friends', locale })

  props.fullWidth = true
  props.hideSidebar = true

  const friendPage =
    props.allPages?.find(
      p =>
        p.type === 'Page' &&
        (p.slug === 'friends' ||
          p.slug === '/friends' ||
          p.href === '/friends')
    ) ||
    props.allPages?.find(
      p =>
        p.type === 'Page' &&
        (String(p.title || '').includes('朋友') ||
          String(p.title || '').toLowerCase().includes('friend'))
    )

  if (friendPage) {
    if (!friendPage.blockMap) {
      try {
        const rawBlockMap = await fetchNotionPageBlocks(
          friendPage.id,
          'friends',
          { cacheVersion: friendPage.lastEditedDate }
        )
        if (rawBlockMap) {
          const adapted = adapterNotionBlockMap(rawBlockMap)
          friendPage.blockMap = {
            ...adapted,
            block: formatNotionBlock(adapted.block)
          }
        }
      } catch (e) {
        console.warn('[friends] fetch blockMap failed:', e)
      }
    }
    props.post = friendPage
  }

  let friends = []
  const token = process.env.NOTION_API_TOKEN

  if (token) {
    try {
      const notion = new Client({ auth: token })
      const response = await notion.databases.query({
        database_id: FRIENDS_DB_ID,
        page_size: 100
      })

      friends = response.results.map(page => {
        const p = page.properties || {}

        const name = p['昵称']?.title?.[0]?.plain_text || ''

        let avatar = ''
        const avatarField = p['头像']
        if (avatarField) {
          if (avatarField.type === 'files' && avatarField.files?.length > 0) {
            const f = avatarField.files[0]
            avatar = f.type === 'external' ? f.external?.url : f.file?.url
          } else if (avatarField.type === 'url') {
            avatar = avatarField.url || ''
          } else if (avatarField.type === 'rich_text') {
            avatar = avatarField.rich_text?.[0]?.plain_text || ''
          }
        }

        const role = p['身份']?.select?.name || ''
        const title = p['头衔']?.select?.name || ''
        const status = p['状态']?.select?.name || ''

        let weibo = p['微博']?.url || ''
        if (!weibo && p['微博']?.rich_text?.[0]?.plain_text) {
          weibo = p['微博'].rich_text[0].plain_text
        }
        if (weibo && !weibo.startsWith('http')) {
          weibo = 'https://' + weibo
        }

        const order = p['排序']?.number ?? 999

        return {
          id: page.id,
          name,
          avatar,
          role,
          title,
          status,
          weibo,
          order
        }
      })

      friends = friends.filter(f => f.status !== '隐藏' && f.name)
      friends.sort((a, b) => a.order - b.order)
    } catch (e) {
      console.error('[friends] 获取友链数据失败:', e)
    }
  }

  props.friends = friends
  props.tagOptions = props.tagOptions || [] // 确保传递 tagOptions

  delete props.allPages

  return {
    props,
    revalidate: process.env.EXPORT
      ? undefined
      : siteConfig(
          'NEXT_REVALIDATE_SECOND',
          BLOG.NEXT_REVALIDATE_SECOND,
          props.NOTION_CONFIG
        )
  }
}

export default Friends
