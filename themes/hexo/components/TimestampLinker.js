// themes/hexo/components/TimestampLinker.js

import { useEffect } from 'react'


function parseExt(ext) {
  if (!ext) return null

  if (typeof ext === 'object') {
    return ext
  }

  if (typeof ext !== 'string') {
    return null
  }

  const value = ext.trim()

  if (!value) return null

  try {
    return JSON.parse(value)
  } catch {
    return value.startsWith('http')
      ? { audio: value }
      : null
  }
}


function getAudioUrl(post) {
  const ext = parseExt(post?.ext)

  return (
    post?.audioUrl ||
    post?.audio ||
    ext?.audioUrl ||
    ext?.audio ||
    null
  )
}


// 支持：
// 01:47
// 1:02:33
function timestampToSeconds(value) {

  const parts = value.split(':').map(i => Number(i))

  if (parts.length === 2) {
    return parts[0] * 60 + parts[1]
  }

  if (parts.length === 3) {
    return (
      parts[0] * 3600 +
      parts[1] * 60 +
      parts[2]
    )
  }

  return null
}


export default function TimestampLinker({ post }) {

  useEffect(() => {

    if (
      typeof window === 'undefined'
    ) {
      return
    }


    let root =
      document.querySelector(
        '#article-wrapper #notion-article'
      )


    if (!root) {
      root =
        document.querySelector(
          '#article-wrapper'
        )
    }


    if (!root) {
      return
    }


    const audioUrl =
      getAudioUrl(post)


    const audioTitle =
      post?.title ||
      '念安酒馆'


    const audioCover =
      post?.pageCoverThumbnail ||
      post?.pageCover ||
      ''


    const audioHref =
      post?.href ||
      ''


    const processed = new WeakSet()


    function createButton(timeText) {


      const seconds =
        timestampToSeconds(timeText)


      const button =
        document.createElement(
          'button'
        )


      button.type =
        'button'


      button.className =
        'hexo-timestamp-btn'


      button.textContent =
        timeText


      button.onclick = () => {


        if (!audioUrl) {

          window.dispatchEvent(
            new CustomEvent(
              'show-no-audio-hint',
              {
                detail:{
                  message:
                  '这篇文章没有对应的音频节目'
                }
              }
            )
          )

          return
        }


        window.dispatchEvent(
          new CustomEvent(
            'seek-global-audio',
            {
              detail:{
                seconds,
                src:audioUrl,
                title:audioTitle,
                cover:audioCover,
                href:audioHref
              }
            }
          )
        )

      }


      return button

    }



    function scan(){


      const walker =
        document.createTreeWalker(
          root,
          NodeFilter.SHOW_TEXT
        )


      const nodes=[]


      let node


      while(
        node = walker.nextNode()
      ){

        if(
          !node.nodeValue ||
          !node.nodeValue.trim()
        ){
          continue
        }


        // 已经处理的不再扫描

        if(
          node.parentElement?.classList
          ?.contains(
            'hexo-timestamp-btn'
          )
        ){
          continue
        }


        nodes.push(node)

      }



      nodes.forEach(
        textNode=>{


          const text =
            textNode.nodeValue


          /*
            匹配文本开头时间

            例如：

            01:47 汤姆与莎莫的故事

            变成：

            [01:47按钮] 汤姆与莎莫的故事
          */


          const reg =
            /(^|\s)(\d{1,2}:\d{2}(?::\d{2})?)(?=\s|$)/g


          if(
            !reg.test(text)
          ){
            return
          }


          reg.lastIndex=0



          const fragment =
            document.createDocumentFragment()


          let lastIndex=0


          let match



          while(
            match = reg.exec(text)
          ){


            const before =
              text.slice(
                lastIndex,
                match.index + match[1].length
              )


            if(before){
              fragment.appendChild(
                document.createTextNode(before)
              )
            }


            fragment.appendChild(
              createButton(
                match[2]
              )
            )


            lastIndex =
              reg.lastIndex

          }


          const after =
            text.slice(lastIndex)


          if(after){
            fragment.appendChild(
              document.createTextNode(after)
            )
          }


          textNode.parentNode
          ?.replaceChild(
            fragment,
            textNode
          )


        }
      )

    }



    // 等 Notion 渲染完成

    const timer =
      setTimeout(
        scan,
        800
      )


    scan()



    const observer =
      new MutationObserver(
        scan
      )


    observer.observe(
      root,
      {
        childList:true,
        subtree:true
      }
    )



    return()=>{

      clearTimeout(timer)

      observer.disconnect()

    }


  },[
    post?.id
  ])



  return null

}
