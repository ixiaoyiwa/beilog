import { siteConfig } from '@/lib/config'
import { useGlobal } from '@/lib/global'
import throttle from 'lodash.throttle'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useRef, useState } from 'react'
import CONFIG from '../config'
import ButtonRandomPost from './ButtonRandomPost'
import Logo from './Logo'
import { MenuListTop } from './MenuListTop'
import SideBar from './SideBar'
import SideBarDrawer from './SideBarDrawer'
import AlgoliaSearchModal from '@/components/AlgoliaSearchModal'

let windowTop = 0

const Header = props => {
  const algoliaSearchRef = useRef()
  const { locale } = useGlobal()
  const router = useRouter()
  const [isOpen, changeShow] = useState(false)
  const showSearchButton = siteConfig('HEXO_MENU_SEARCH', false, CONFIG)
  const showRandomButton = siteConfig('HEXO_MENU_RANDOM', false, CONFIG)

  const toggleMenuOpen = () => changeShow(!isOpen)
  const toggleSideBarClose = () => changeShow(false)

  useEffect(() => {
    window.addEventListener('scroll', topNavStyleHandler, { passive: true })
    router.events.on('routeChangeComplete', topNavStyleHandler)
    topNavStyleHandler()

    return () => {
      router.events.off('routeChangeComplete', topNavStyleHandler)
      window.removeEventListener('scroll', topNavStyleHandler)
    }
  }, [])

  const throttleMs = 200

  const topNavStyleHandler = useCallback(
    throttle(() => {
      const scrollS = window.scrollY
      const nav = document.querySelector('#sticky-nav')
      const header = document.querySelector('#header')

      const scrollInHeader = header && (scrollS < 10 || scrollS < header?.clientHeight - 50)
      if (!nav) return

      if (scrollInHeader) {
        nav.classList.replace('bg-white', 'bg-none')
        nav.classList.remove('border', 'border-transparent', 'border-gray-200', 'dark:border-transparent', 'dark:border-gray-800')
        nav.classList.add('border-0', 'border-b', 'border-transparent', 'dark:border-transparent')
        nav.classList.remove('drop-shadow-md')
        nav.classList.add('shadow-none')
        nav.classList.replace('dark:bg-hexo-black-gray', 'transparent')
      } else {
        nav.classList.replace('bg-none', 'bg-white')
        nav.classList.remove('border', 'border-transparent', 'border-gray-200', 'dark:border-transparent', 'dark:border-gray-800')
        nav.classList.add('border-0', 'border-b', 'border-gray-200', 'dark:border-gray-800')
        nav.classList.remove('drop-shadow-md')
        nav.classList.add('shadow-none')
        nav.classList.replace('transparent', 'dark:bg-hexo-black-gray')
      }

      if (scrollInHeader) {
        nav.classList.replace('text-black', 'text-white')
      } else {
        nav.classList.replace('text-white', 'text-black')
      }

      const showNav = scrollS <= windowTop || scrollS < 5 || (header && scrollS <= header.clientHeight + 100)
      if (!showNav) {
        nav.classList.replace('top-0', '-top-20')
        windowTop = scrollS
      } else {
        nav.classList.replace('-top-20', 'top-0')
        windowTop = scrollS
      }
    }, throttleMs)
  )

  return (
    <div id='top-nav' className='z-40'>
      <AlgoliaSearchModal cRef={algoliaSearchRef} />

      <div
        id='sticky-nav'
        style={{ backdropFilter: 'blur(3px)' }}
        className='top-0 duration-300 transition-all shadow-none fixed bg-none dark:bg-hexo-black-gray dark:text-gray-200 text-black w-full z-20 transform border-0 border-b border-transparent dark:border-transparent'>
        <div className='w-full flex justify-between items-center px-4 py-2'>
          <div className='flex'>
            <Logo {...props} />
          </div>

          <div className='mr-1 flex justify-end items-center'>
            <div className='hidden lg:flex'>
              <MenuListTop {...props} />
            </div>

            <div onClick={toggleMenuOpen} className='w-8 justify-center items-center h-8 cursor-pointer flex lg:hidden'>
              {isOpen ? <i className='fas fa-times' /> : <i className='fas fa-bars' />}
            </div>

            {/* 这里的按钮直接继承上层文字颜色，不写 text-gray-600 */}
            {showSearchButton && (
              <button
                type='button'
                aria-label='搜索'
                onClick={() => algoliaSearchRef.current?.openSearch()}
                className='w-8 h-8 flex justify-center items-center cursor-pointer ml-2 hover:opacity-70 transition-opacity'
              >
                <i className='fas fa-search' />
              </button>
            )}
            
            {showRandomButton && <ButtonRandomPost {...props} />}
          </div>
        </div>
      </div>

      <SideBarDrawer isOpen={isOpen} onClose={toggleSideBarClose}>
        <SideBar {...props} />
      </SideBarDrawer>
    </div>
  )
}

export default Header
