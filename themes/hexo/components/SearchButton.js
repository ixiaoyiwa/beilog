import { useGlobal } from '@/lib/global'
import { useRouter } from 'next/router'

/**
 * 搜索入口：统一跳转到 /search 页面，不再打开 Algolia 弹窗。
 */
export default function SearchButton() {
  const { locale } = useGlobal()
  const router = useRouter()

  function handleSearch() {
    if (router.pathname === '/search' || router.asPath.split('?')[0].replace(/\/$/, '') === '/search') {
      const input = document.getElementById('algolia-search-page-input')
      if (input) {
        input.focus()
        input.scrollIntoView({ block: 'center', behavior: 'smooth' })
        return
      }
    }
    router.push('/search')
  }

  return (
    <button
      type='button'
      onClick={handleSearch}
      title={locale.NAV.SEARCH}
      aria-label={locale.NAV.SEARCH}
      className='flex h-10 w-10 cursor-pointer items-center justify-center rounded-full transition-all duration-200 hover:bg-black hover:bg-opacity-10 dark:text-white'>
      <i className='fa-solid fa-magnifying-glass' aria-hidden='true' />
    </button>
  )
}
