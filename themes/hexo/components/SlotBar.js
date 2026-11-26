import { useState } from 'react'
import SmartLink from '@/components/SmartLink'
import { siteConfig } from '@/lib/config'

/**
 * 博客列表上方嵌入条
 * @param {*} props
 * @returns
 */
export default function SlotBar(props) {
  const {
    tag,
    category,
    friends = [],
    categories = [],
    categoryOptions = []
  } = props

  const [imgFailed, setImgFailed] = useState(false)

  // 分类简介映射表
  const introMap = {
    '展信安': '见字如面，借一点慢下来的仪式感，让故事有处可放，让心事有处可安。',
    'Letters': '见字如面，借一点慢下来的仪式感，让故事有处可放，让心事有处可安。',
    '碎碎念': '一闪念、一程路、几帧光影……录成声音日记，慢慢拼凑出真实的自己。',
    'Musings': '一闪念、一程路、几帧光影……录成声音日记，慢慢拼凑出真实的自己。',
    '慢漫聊': '把生活里的琐碎，慢慢聊出点滋味。要是有一句，说到你心里，就够了。',
    'Talks': '把生活里的琐碎，慢慢聊出点滋味。要是有一句，说到你心里，就够了。'
  }

  const categoryCountSource = Array.isArray(categories) && categories.length > 0
    ? categories
    : Array.isArray(categoryOptions)
      ? categoryOptions
      : []

  const normalizeCategoryName = value => String(value ?? '').trim().toLowerCase()

  const categoryDefinitions = [
    { id: 'Letters', name: '展信安', icon: 'far fa-folder-open', aliases: ['Letters', '展信安'] },
    { id: 'Musings', name: '碎碎念', icon: 'far fa-folder-open', aliases: ['Musings', '碎碎念'] },
    { id: 'Talks', name: '慢漫聊', icon: 'far fa-folder-open', aliases: ['Talks', '慢漫聊'] }
  ]

  const categoryTabs = categoryDefinitions.map(tab => {
    const aliases = tab.aliases.map(normalizeCategoryName)
    const matchedCategory = categoryCountSource.find(item =>
      aliases.includes(normalizeCategoryName(item?.name))
    )
    const parsedCount = Number(matchedCategory?.count)

    return {
      id: tab.id,
      name: tab.name,
      icon: tab.icon,
      count: Number.isFinite(parsedCount) && parsedCount >= 0 ? parsedCount : 0
    }
  })

  // Notion 颜色映射
  const colorMap = {
    default: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
    gray: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
    brown: 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300',
    orange: 'bg-orange-100 text-orange-700 dark:bg-orange-900/60 dark:text-orange-300',
    yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/60 dark:text-yellow-300',
    green: 'bg-green-100 text-green-700 dark:bg-green-900/60 dark:text-green-300',
    blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300',
    purple: 'bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300',
    pink: 'bg-pink-100 text-pink-700 dark:bg-pink-900/60 dark:text-pink-300',
    red: 'bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-300'
  }

  if (tag) {
    const friendData = friends.find(f => f.name === tag)
    const title = friendData?.title
    const titleColor = colorMap[friendData?.color] || colorMap.default
    const fallbackAvatar = siteConfig('HOME_BANNER_IMAGE') || ''
    const avatarSrc = friendData?.avatar || fallbackAvatar
    const showImage = avatarSrc && !imgFailed

    const avatarFrameStyle = {
      border: '1px solid rgba(200, 122, 56, 0.48)',
      boxShadow: '0 0 10px rgba(200, 122, 56, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.16)'
    }

    return (
      <div className="px-3 py-2 mb-3">
        <SmartLink
          key={tag}
          href={`/tag/${encodeURIComponent(tag)}`}
          passHref
          className="inline-flex items-center gap-3 group cursor-pointer rounded-xl py-1 px-1.5 transition-colors duration-200"
        >
          {/* 36px 圆形头像 + 极细暗金琥珀微光边框（100% 同步 FriendCard 头像源与兜底） */}
          {showImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarSrc}
              alt={tag}
              onError={() => setImgFailed(true)}
              style={avatarFrameStyle}
              className="w-9 h-9 rounded-full object-cover flex-shrink-0 transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div
              className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold text-white select-none transition-transform duration-300 group-hover:scale-105"
              style={{ backgroundColor: 'var(--theme-color)', ...avatarFrameStyle }}
            >
              {String(tag).charAt(0)}
            </div>
          )}

          <div className="flex items-center gap-2">
            <span className="text-xl font-medium tracking-wide text-gray-800 dark:text-gray-100 group-hover:text-[var(--theme-color)] transition-colors">
              {tag}
            </span>
            {title && (
              <span className={`text-xs px-2 py-0.5 rounded-md font-normal ${titleColor}`}>
                {title}
              </span>
            )}
          </div>
        </SmartLink>
      </div>
    )
  } else if (category) {
    const introText = introMap[category]
    return (
      <div className={`px-4 py-1 ${introText ? 'mb-6' : 'mb-2'}`}>
        {/* 分类切换 Tab 栏：选中态为 #C87A38 立体暖琥珀；未选中态统一采用同色系 1px 主题色细边框 + 柔和磨砂玻璃 */}
        <div className="flex flex-wrap gap-3 mb-4">
          {categoryTabs.map(tab => {
            const isActive = category === tab.id || category === tab.name
            return (
              <SmartLink
                key={tab.id}
                href={`/category/${tab.id}`}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm rounded-xl backdrop-blur-md transition-all duration-300 cursor-pointer whitespace-nowrap hover:-translate-y-0.5 text-white/95 ${
                  isActive ? 'font-medium hover:brightness-105' : 'bg-white/[0.06] hover:bg-[#C87A38]/20'
                }`}
                style={
                  isActive
                    ? {
                        background: 'linear-gradient(180deg, #D68744 0%, #B86828 100%)',
                        border: '1px solid rgba(110, 48, 12, 0.45)',
                        boxShadow:
                          'inset 0 1px 0 rgba(255, 255, 255, 0.34), inset 0 -1px 0 rgba(0, 0, 0, 0.22), 0 8px 20px -6px rgba(200, 122, 56, 0.45)'
                      }
                    : {
                        border: '1px solid rgba(200, 122, 56, 0.48)',
                        boxShadow:
                          'inset 0 1px 0 rgba(255, 255, 255, 0.14), 0 6px 16px -4px rgba(0, 0, 0, 0.22)'
                      }
                }
              >
                <i className={`${isActive ? 'far fa-folder-open' : 'far fa-folder'} text-xs`} />
                <span>{tab.name}</span>
                <span className={`text-[11px] ${isActive ? 'opacity-85' : 'opacity-75'}`}>
                  ({tab.count})
                </span>
              </SmartLink>
            )
          })}
        </div>
        {/* 简介文字 */}
        {introText && (
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 leading-relaxed break-words">
            {introText}
          </p>
        )}
      </div>
    )
  }
  return <></>
}
