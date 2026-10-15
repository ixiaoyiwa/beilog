import { useState } from 'react'
import SmartLink from '@/components/SmartLink'
import { siteConfig } from '@/lib/config'

const FriendCard = ({ member }) => {
  const isOnline = member.status === '在馆'
  const isUnknown = member.status === '未知' || !member.status
  const [imgFailed, setImgFailed] = useState(false)

  const fallbackAvatar = siteConfig('HOME_BANNER_IMAGE') || ''
  const avatarSrc = member.avatar || fallbackAvatar
  const showImage = avatarSrc && !imgFailed

  return (
    <div className='flex flex-col items-center p-2 rounded-xl bg-[var(--hexo-color-card)] transition-all duration-200 hover:shadow-md'>
      {/* 头像 + 状态点 */}
      <SmartLink
        href={`/tag/${encodeURIComponent(member.name)}`}
        className='relative mb-2 cursor-pointer block'>
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarSrc}
            alt=''
            onError={() => setImgFailed(true)}
            className='w-16 h-16 rounded-full object-cover'
          />
        ) : (
          <div
            className='w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white select-none'
            style={{ backgroundColor: 'var(--theme-color)' }}>
            {member.name.charAt(0)}
          </div>
        )}
        <span
          className='absolute bottom-0.5 right-0.5 w-3 h-3 rounded-full border-2 border-[var(--hexo-color-card)]'
          style={{
            backgroundColor: isOnline ? '#22c55e' : isUnknown ? '#eab308' : '#9ca3af'
          }}
        />
      </SmartLink>

      {/* 昵称 */}
      <SmartLink
        href={`/tag/${encodeURIComponent(member.name)}`}
        className='text-base font-bold text-gray-800 dark:text-gray-100 hover:text-[var(--theme-color)] transition-colors truncate max-w-full text-center mb-1'>
        {member.name}
      </SmartLink>

      {/* 头衔 */}
      {member.title && (
        <div className='text-sm text-gray-500 dark:text-gray-400 text-center mb-2'>
          {member.title}
        </div>
      )}

      {/* 关注按钮：默认显示 */}
      {member.weibo && (
        <a
          href={member.weibo}
          target='_blank'
          rel='noopener noreferrer'
          className='mt-1 px-3 py-0.5 text-sm rounded-full border border-[var(--theme-color)] text-[var(--theme-color)] hover:bg-[var(--theme-color)] hover:text-white transition-colors'>
          +关注
        </a>
      )}
    </div>
  )
}

export default FriendCard
