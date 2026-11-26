import { useRouter } from 'next/router'
import Card from './Card'
import SocialButton from './SocialButton'
import MenuGroupCard from './MenuGroupCard'
import LazyImage from '@/components/LazyImage'
import { siteConfig } from '@/lib/config'

/**
 * 社交信息卡
 * @param {*} props
 * @returns
 */
export function InfoCard(props) {
  const { className, siteInfo } = props
  const router = useRouter()

  const avatarFrameStyle = {
    border: '1px solid rgba(200, 122, 56, 0.48)',
    boxShadow: '0 0 16px rgba(200, 122, 56, 0.24), inset 0 1px 0 rgba(255, 255, 255, 0.16)'
  }

  return (
        <Card className={className}>
            <div
                className='justify-center items-center flex py-6 dark:text-gray-100 transform duration-200 cursor-pointer group'
                onClick={() => {
                  router.push('/')
                }}
            >
                <div
                  className='rounded-full overflow-hidden transition-transform duration-300 group-hover:scale-105'
                  style={avatarFrameStyle}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <LazyImage src={siteInfo?.icon} className='rounded-full block' width={120} height={120} alt={siteConfig('AUTHOR')} />
                </div>
            </div>
            <div className='font-medium text-center text-xl pb-4'>{siteConfig('AUTHOR')}</div>
            <div className='text-sm text-center'>{siteConfig('BIO')}</div>
            <MenuGroupCard {...props} />
            <SocialButton />
        </Card>
  )
}
