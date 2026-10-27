import { siteConfig } from '@/lib/config'
import { useGlobal } from '@/lib/global'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import SharePosterModal from '@/components/SharePosterModal'

const QrCode = dynamic(() => import('@/components/QrCode'), { ssr: false })
const BASE_BUTTON_CLASS =
  'cursor-pointer rounded-full mx-1 w-8 h-8 flex items-center justify-center text-white transition-colors duration-200'
const ICON_CLASS = 'text-sm leading-none'
const SHARE_ICON_CLASS = {
  facebook: 'fab fa-facebook-f',
  messenger: 'fab fa-facebook-messenger',
  line: 'fab fa-line',
  reddit: 'fab fa-reddit-alien',
  email: 'fas fa-envelope',
  twitter: 'fab fa-x-twitter',
  telegram: 'fab fa-telegram-plane',
  whatsapp: 'fab fa-whatsapp',
  linkedin: 'fab fa-linkedin-in',
  pinterest: 'fab fa-pinterest-p',
  vkshare: 'fab fa-vk',
  okshare: 'fas fa-share-nodes',
  tumblr: 'fab fa-tumblr',
  livejournal: 'fas fa-book-open',
  mailru: 'fas fa-at',
  viber: 'fab fa-viber',
  workplace: 'fas fa-briefcase',
  weibo: 'fab fa-weibo',
  pocket: 'fas fa-bookmark',
  instapaper: 'fas fa-newspaper',
  hatena: 'fas fa-h',
  threads: 'fas fa-at'
}

const SHARE_HOVER_COLORS = {
  facebook: '#1877F2',
  messenger: '#00B2FF',
  line: '#00C300',
  reddit: '#FF4500',
  email: '#0078D4', // ✨ 改成了 Outlook 蓝
  twitter: '#000000',
  telegram: '#26A5E4',
  whatsapp: '#25D366',
  linkedin: '#0A66C2',
  pinterest: '#E60023',
  vkshare: '#4C75A3',
  okshare: '#EE8208',
  tumblr: '#35465C',
  weibo: '#E6162D',
  threads: '#000000',
  wechat: '#07C160',
  qq: '#12B7F5',
  link: '#EAB308' // ✨ 海报按钮的黄色移到这里
}

const ShareButtons = ({ post }) => {
  const router = useRouter()
  const [shareUrl, setShareUrl] = useState(siteConfig('LINK') + router.asPath)
  const title = post?.title || siteConfig('TITLE')
  const image = post?.pageCover
  const tags = post?.tags || []
  const hashTags = tags.map(tag => `#${tag}`).join(',')
  const body = post?.title + ' | ' + title + ' ' + shareUrl + ' ' + post?.summary
  const configuredServices = siteConfig('POSTS_SHARE_SERVICES')
  const services = (Array.isArray(configuredServices) ? configuredServices : String(configuredServices || '').split(','))
    .map(service => String(service).trim())
    .filter(Boolean)
  const titleWithSiteInfo = title + ' | ' + siteConfig('TITLE')
  const { locale } = useGlobal()
  const [qrCodeShow, setQrCodeShow] = useState(false)
  const [sharePosterOpen, setSharePosterOpen] = useState(false)

  const primaryColor = siteConfig('HEXO_COLOR_PRIMARY', '#3A4A7A')

  const openPopover = () => setQrCodeShow(true)
  const closePopover = () => setQrCodeShow(false)

  const openRedirectShare = base => {
    if (!shareUrl || typeof window === 'undefined') return
    window.open(`${base}${encodeURIComponent(shareUrl)}`, '_blank', 'noopener,noreferrer')
  }

  const openShareWindow = url => {
    if (!url || typeof window === 'undefined') return
    window.open(url, '_blank', 'noopener,noreferrer,width=760,height=640')
  }

  const buildShareUrl = service => {
    const encodedUrl = encodeURIComponent(shareUrl)
    const encodedTitle = encodeURIComponent(titleWithSiteInfo)
    const encodedBody = encodeURIComponent(body)
    const encodedImage = encodeURIComponent(image || '')
    const encodedHashTags = encodeURIComponent(hashTags)
    const appId = siteConfig('FACEBOOK_APP_ID') || ''
    switch (service) {
      case 'facebook': return `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&hashtag=${encodedHashTags}`
      case 'messenger': return `https://www.facebook.com/dialog/send?app_id=${appId}&link=${encodedUrl}&redirect_uri=${encodedUrl}`
      case 'line': return `https://social-plugins.line.me/lineit/share?url=${encodedUrl}`
      case 'reddit': return `https://www.reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}`
      case 'email': return `mailto:?subject=${encodedTitle}&body=${encodedBody}`
      case 'twitter': return `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}&hashtags=${encodeURIComponent(tags.join(','))}`
      case 'telegram': return `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`
      case 'whatsapp': return `https://api.whatsapp.com/send?text=${encodeURIComponent(`${titleWithSiteInfo} ${shareUrl}`)}`
      case 'linkedin': return `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`
      case 'pinterest': return `https://pinterest.com/pin/create/button/?url=${encodedUrl}&media=${encodedImage}&description=${encodedTitle}`
      case 'vkshare': return `https://vk.com/share.php?url=${encodedUrl}&image=${encodedImage}`
      case 'okshare': return `https://connect.ok.ru/offer?url=${encodedUrl}&title=${encodedTitle}`
      case 'tumblr': return `https://www.tumblr.com/widgets/share/tool?canonicalUrl=${encodedUrl}&title=${encodedTitle}&tags=${encodeURIComponent(tags.join(','))}`
      case 'livejournal': return `https://www.livejournal.com/update.bml?subject=${encodedTitle}&event=${encodedBody}`
      case 'mailru': return `https://connect.mail.ru/share?share_url=${encodedUrl}&title=${encodedTitle}`
      case 'viber': return `viber://forward?text=${encodeURIComponent(`${titleWithSiteInfo} ${shareUrl}`)}`
      case 'workplace': return `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedTitle}`
      case 'weibo': return `https://service.weibo.com/share/share.php?url=${encodedUrl}&title=${encodedTitle}&pic=${encodedImage}`
      case 'pocket': return `https://getpocket.com/edit?url=${encodedUrl}&title=${encodedTitle}`
      case 'instapaper': return `http://www.instapaper.com/edit?url=${encodedUrl}&title=${encodedTitle}`
      case 'hatena': return `https://b.hatena.ne.jp/add?mode=confirm&url=${encodedUrl}&title=${encodedTitle}`
      case 'threads': return `https://www.threads.net/intent/post?text=${encodeURIComponent(`${titleWithSiteInfo} ${shareUrl}`)}`
      default: return null
    }
  }

  const renderCommonShareButton = service => {
    const shareLink = buildShareUrl(service)
    if (!shareLink) return null
    const iconClass = SHARE_ICON_CLASS[service] || 'fas fa-share-alt'
    const hoverColor = SHARE_HOVER_COLORS[service] || primaryColor

    return (
      <button 
        aria-label={service} 
        key={service} 
        onClick={() => openShareWindow(shareLink)} 
        className={BASE_BUTTON_CLASS}
        style={{ backgroundColor: primaryColor }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = hoverColor }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = primaryColor }}
        title={service}>
        <i className={`${iconClass} ${ICON_CLASS}`} />
      </button>
    )
  }

  useEffect(() => { setShareUrl(window.location.href) }, [])

  return (
    <>
      {services.map(singleService => {
        switch (singleService) {
          case 'facebook': case 'messenger': case 'line': case 'reddit': case 'email': case 'twitter': case 'telegram': case 'whatsapp': case 'linkedin': case 'pinterest': case 'vkshare': case 'okshare': case 'tumblr': case 'livejournal': case 'mailru': case 'viber': case 'workplace': case 'weibo': case 'pocket': case 'instapaper': case 'hatena': case 'threads':
            return renderCommonShareButton(singleService)
          case 'qq':
            return (
              <button 
                aria-label={singleService} 
                key={singleService} 
                onClick={() => openShareWindow(`http://connect.qq.com/widget/shareqq/index.html?url=${shareUrl}&sharesource=qzone&title=${title}&desc=${body}`)} 
                className={BASE_BUTTON_CLASS}
                style={{ backgroundColor: primaryColor }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = SHARE_HOVER_COLORS['qq'] }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = primaryColor }}
                title={singleService}>
                <i className={`fab fa-qq ${ICON_CLASS}`} />
              </button>
            )
          case 'wechat':
            return (
              <button 
                onMouseEnter={(e) => {
                  openPopover();
                  e.currentTarget.style.backgroundColor = SHARE_HOVER_COLORS['wechat'];
                }} 
                onMouseLeave={(e) => {
                  closePopover();
                  e.currentTarget.style.backgroundColor = primaryColor;
                }}
                aria-label={singleService} 
                key={singleService} 
                className={`${BASE_BUTTON_CLASS} relative`}
                style={{ backgroundColor: primaryColor }}
                title={singleService}>
                <i className={`fab fa-weixin ${ICON_CLASS}`} />
                <div className='absolute'>
                  <div id='pop' className={(qrCodeShow ? 'opacity-100 ' : ' invisible opacity-0') + ' z-40 absolute bottom-10 -left-10 bg-white shadow-xl transition-all duration-200 text-center'}>
                    <div className='p-2 mt-1 w-28 h-28'>{qrCodeShow && <QrCode value={shareUrl} />}</div>
                    <span className='text-black font-semibold p-1 rounded-t-lg text-sm mx-auto mb-1'>{locale.COMMON.SCAN_QR_CODE}</span>
                  </div>
                </div>
              </button>
            )
          case 'link':
            return (
              <button 
                aria-label='分享这一期' 
                key={singleService} 
                onClick={() => setSharePosterOpen(true)} 
                className={BASE_BUTTON_CLASS}
                style={{ backgroundColor: primaryColor }} // ✨ 统一底色
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = SHARE_HOVER_COLORS['link'] }} // ✨ 悬停变黄
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = primaryColor }}
                title='分享海报 / 复制链接'>
                <i className={`fas fa-share-alt ${ICON_CLASS}`} />
              </button>
            )
          case 'csdn':
            return (
              <button aria-label={singleService} key={singleService} onClick={() => openRedirectShare('https://link.csdn.net/?target=')} className='cursor-pointer rounded-full mx-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500' title={singleService}>
                <div className='w-8 h-8 rounded-full flex items-center justify-center' style={{ backgroundColor: '#ff6a00' }}><Image src='/svg/csdn.svg' alt='CSDN' width={28} height={28} className='w-5 h-5' loading='lazy' unoptimized /></div>
              </button>
            )
          case 'juejin':
            return (
              <button aria-label={singleService} key={singleService} onClick={() => openRedirectShare('https://link.juejin.cn/?target=')} className='cursor-pointer rounded-full mx-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500' title={singleService}>
                <div className='w-8 h-8 rounded-full flex items-center justify-center' style={{ backgroundColor: '#5dade2' }}><Image src='/svg/juejin.svg' alt='掘金' width={24} height={24} className='w-5 h-5' loading='lazy' unoptimized /></div>
              </button>
            )
          default: return null
        }
      })}
      <SharePosterModal open={sharePosterOpen} onClose={() => setSharePosterOpen(false)} post={post} shareUrl={shareUrl} />
    </>
  )
}

export default ShareButtons
