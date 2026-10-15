import BLOG from '@/blog.config'
import { siteConfig } from '@/lib/config'
import { fetchGlobalAllData } from '@/lib/db/SiteDataApi'
import { DynamicLayout } from '@/themes/theme'
import { Client } from '@notionhq/client' // 新增：引入 Notion 客户端

// 新增：数据库 ID
const FRIENDS_DB_ID = '3e91137a265a80d19b7bca7ee29ae8a1'

/**
 * 标签下的文章列表
 * @param {*} props
 * @returns
 */
const Tag = props => {
  const theme = siteConfig('THEME', BLOG.THEME, props.NOTION_CONFIG)
  return <DynamicLayout theme={theme} layoutName='LayoutPostList' {...props} />
}

export async function getStaticProps({ params: { tag }, locale }) {
  const from = 'tag-props'
  const props = await fetchGlobalAllData({ from, locale })

  // --- 新增：获取朋友数据，供 SlotBar 显示头衔色块 ---
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
        return { id: page.id, name, avatar, role, title, status, weibo, order }
      })
      friends = friends.filter(f => f.status !== '隐藏' && f.name)
      friends.sort((a, b) => a.order - b.order)
    } catch (e) {
      console.error('[tag-props] 获取友链数据失败:', e)
    }
  }
  props.friends = friends
  // --- 新增结束 ---

  // 过滤状态
  props.posts = props.allPages
    ?.filter(page => page.type === 'Post' && page.status === 'Published')
    .filter(post => post && post?.tags && post?.tags.includes(tag))

  // 处理文章页数
  props.postCount = props.posts.length

  // 处理分页
  const POST_LIST_STYLE = siteConfig(
    'POST_LIST_STYLE',
    'page',
    props?.NOTION_CONFIG
  )
  if (POST_LIST_STYLE === 'scroll') {
    // 滚动列表 给前端返回所有数据
  } else if (POST_LIST_STYLE === 'page') {
    props.posts = props.posts?.slice(
      0,
      siteConfig('POSTS_PER_PAGE', 12, props?.NOTION_CONFIG)
    )
  }

  props.tag = tag
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

/**
 * 获取所有的标签
 * @returns
 * @param tags
 */
function getTagNames(tags) {
  if (!Array.isArray(tags)) {
    return []
  }
  const tagNames = []
  tags.forEach(tag => {
    tagNames.push(tag.name)
  })
  return tagNames
}

export async function getStaticPaths() {
  const from = 'tag-static-path'
  const { tagOptions } = await fetchGlobalAllData({ from })
  const tagNames = getTagNames(tagOptions)

  return {
    paths: tagNames.map(tag => ({
      params: { tag }
    })),
    fallback: true
  }
}

export default Tag
