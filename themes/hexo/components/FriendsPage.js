import { useEffect, useRef } from 'react'
import NotionPage from '@/components/NotionPage'
import Comment from '@/components/Comment'
import FriendCard from './FriendCard'

const ROLE_ORDER = ['守夜人', '夜谈人', '酿酒人', '调酒人']

// false：不渲染 Notion 正文（页面里只有数据库时用这个，空白必定消失）
// true ：渲染 Notion 正文，但用脚本隐藏数据库块和它的空外壳（页面里还有介绍文字时用这个）
const SHOW_NOTION_CONTENT = false

const COLLECTION_SELECTOR = [
  '[class*="notion-collection"]',
  '[class*="notion-table"]',
  '[class*="notion-board"]',
  '[class*="notion-gallery"]',
  '[class*="notion-list-collection"]'
].join(',')

const FriendsPage = ({ post, friends = [], tagOptions = [] }) => {
  const contentRef = useRef(null)

  useEffect(() => {
    if (!SHOW_NOTION_CONTENT) return
    const root = contentRef.current
    if (!root) return

    const isVisible = el => el.style.display !== 'none'

    const cleanup = () => {
      // 1. 先隐藏空白块
      root.querySelectorAll('.notion-blank').forEach(el => {
        el.style.display = 'none'
      })
      root.querySelectorAll('.notion-text').forEach(el => {
        if (!el.textContent.trim() && !el.querySelector('img,video,audio,iframe')) {
          el.style.display = 'none'
        }
      })

      // 2. 隐藏数据库块，并向上把"只装着它的外壳"一起隐藏
      root.querySelectorAll(COLLECTION_SELECTOR).forEach(col => {
        let target = col
        while (target.parentElement && target.parentElement !== root) {
          const parent = target.parentElement
          const otherVisible = Array.from(parent.children).some(
            c => c !== target && isVisible(c)
          )
          if (otherVisible) break
          target = parent
        }
        target.style.display = 'none'
      })

      // 3. 如果整个容器已经没有可见内容，直接收起容器
      const hasMedia = Array.from(root.querySelectorAll('img,video,audio,iframe'))
        .some(el => el.offsetParent !== null)
      if (!root.innerText.trim() && !hasMedia) {
        root.style.display = 'none'
      } else {
        root.style.display = ''
      }
    }

    let raf = 0
    const schedule = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(cleanup)
    }

    schedule()
    // Notion 内容可能是异步渲染出来的，监听后续变化
    const observer = new MutationObserver(schedule)
    observer.observe(root, { childList: true, subtree: true })

    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
    }
  }, [post])

  const mergedMembers = [...friends]

  if (tagOptions && tagOptions.length > 0) {
    tagOptions.forEach(tag => {
      if (!mergedMembers.some(f => f.name === tag.name)) {
        mergedMembers.push({
          id: `missing-${tag.name}`,
          name: tag.name,
          role: '调酒人',
          status: '未知'
        })
      }
    })
  }

  const groups = []
  const groupMap = {}

  mergedMembers.forEach(f => {
    const role = f.role || '其他'
    if (!groupMap[role]) {
      groupMap[role] = { role, members: [] }
      groups.push(groupMap[role])
    }
    groupMap[role].members.push(f)
  })

  groups.sort((a, b) => {
    const ia = ROLE_ORDER.indexOf(a.role)
    const ib = ROLE_ORDER.indexOf(b.role)
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)
  })

  return (
    <div className='w-full lg:hover:shadow lg:border rounded-t-xl lg:rounded-xl lg:px-2 lg:py-4 bg-white dark:bg-hexo-black-gray dark:border-black article'>
      <div className='w-full md:px-5 px-2'>
        {post && SHOW_NOTION_CONTENT && (
          <div ref={contentRef} className='friends-notion-content'>
            <NotionPage post={post} />
          </div>
        )}

        {groups.length > 0 && (
          <div className='mt-2'>
            {groups.map(group => (
              <section key={group.role} className='mb-16 last:mb-0'>
                <div className='mb-6 text-center'>
                  <h2 className='text-2xl font-bold text-gray-800 dark:text-gray-100 text-center'>
                    {group.role}
                  </h2>
                  <div
                    className='mt-3 border-b border-dotted'
                    style={{ borderColor: 'var(--hexo-color-border)' }}
                  />
                </div>

                <div className='grid grid-cols-3 lg:grid-cols-6 gap-2'>
                  {group.members.map(member => (
                    <FriendCard key={member.id || member.name} member={member} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {post && (
          <div className='mt-10 duration-200 overflow-x-auto px-3'>
            <Comment frontMatter={post} />
          </div>
        )}

        <style jsx global>{`
          .friends-notion-content .notion-page,
          .friends-notion-content .notion-page-content,
          .friends-notion-content .notion-page-content-inner,
          .friends-notion-content .notion-page-no-cover {
            margin-top: 0 !important;
            padding-top: 0 !important;
            padding-bottom: 0 !important;
            min-height: 0 !important;
          }
          .friends-notion-content [class*='notion-collection'],
          .friends-notion-content [class*='notion-table'],
          .friends-notion-content [class*='notion-board'],
          .friends-notion-content [class*='notion-gallery'] {
            display: none !important;
          }
        `}</style>
      </div>
    </div>
  )
}

export default FriendsPage
