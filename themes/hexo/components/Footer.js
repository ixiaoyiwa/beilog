import { useRef } from 'react'
import BeiAnSite from '@/components/BeiAnSite'
import { siteConfig } from '@/lib/config'

// 后台地址:改成你实际使用的地址(必须带 https://)
const ADMIN_URL = 'https://osna.885111.xyz/'
const CLICKS_NEEDED = 3 // 连续点击次数
const CLICK_WINDOW_MS = 1500 // 相邻两次点击的最长间隔(毫秒)

const Footer = ({ title }) => {
  const d = new Date()
  const currentYear = d.getFullYear()
  const since = siteConfig('SINCE')
  const copyrightDate =
    parseInt(since) < currentYear ? since + '-' + currentYear : currentYear

  const clicks = useRef({ n: 0, t: 0 })
  const onSecretClick = () => {
    const now = Date.now()
    const c = clicks.current
    c.n = now - c.t > CLICK_WINDOW_MS ? 1 : c.n + 1
    c.t = now
    if (c.n >= CLICKS_NEEDED) {
      c.n = 0
      window.open(ADMIN_URL, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <footer className='relative z-10 flex-shrink-0 justify-center text-center m-auto w-full leading-6 text-gray-600 dark:text-gray-100 text-sm pt-6 pb-6'>
      <span
        onClick={onSecretClick}
        className='select-none touch-manipulation'>
        <i className='fas fa-copyright' /> {`${copyrightDate}`}
      </span>
      <span>
        <a
          href={siteConfig('LINK')}
          className='font-bold dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors ml-2'>
          {siteConfig('AUTHOR')}
        </a>
        <BeiAnSite />
      </span>
    </footer>
  )
}

export default Footer
