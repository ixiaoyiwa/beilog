import BeiAnSite from '@/components/BeiAnSite'
import { siteConfig } from '@/lib/config'

const Footer = ({ title }) => {
  const d = new Date()
  const currentYear = d.getFullYear()
  const since = siteConfig('SINCE')
  const copyrightDate =
    parseInt(since) < currentYear ? since + '-' + currentYear : currentYear

  return (
    <footer className='relative z-10 flex-shrink-0 justify-center text-center m-auto w-full leading-6 text-gray-600 dark:text-gray-100 text-sm pt-6 pb-6'>
      <i className='fas fa-copyright' /> {`${copyrightDate}`}
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
