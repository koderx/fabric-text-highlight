import { useEffect, useRef } from 'react'
import './App.css'
import * as fabric from 'fabric'
import { HighlightText } from './highlight_text'

function randomColor() {
  const r = Math.floor(Math.random() * 255)
  const g = Math.floor(Math.random() * 255)
  const b = Math.floor(Math.random() * 255)
  const hex = ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).substring(0, 6)
  return `#${hex}`
}

const renderText = (canvas: fabric.Canvas) => {
  const text = new HighlightText('那些杀不死我的\n终将使我更强大')
  text.selectable = false
  text.evented = false
  text.originX = 'center'
  text.originY = 'center'
  canvas.add(text)
  canvas.centerObject(text)
  text.top = 200
  text
    .setTexts([
      { text: '那些杀不死' },
      // 可以自动切分换行
      {
        text: '我的\n终将',
        highlight: {
          type: 'svg',
          url: 'https://cdn.dancf.com/fe-assets/20240813/c4db70c1b7a9c2fb1ded5039cbacbf2b.svg',
          svgInfo: { colors: ['#ffc300ff'] },
        },
      },
      { text: '使我更强大' },
    ])
    .then((res) => {
      if (res) {
        canvas.requestRenderAll()
      }
    })

  function animate(obj: fabric.Object) {
    obj.animate(
      { angle: 360 },
      {
        duration: 2000,
        onComplete: () => {
          obj.angle = 0
          animate(obj)
        },
        easing: (t, b, c, d) => (c * t) / d + b,
      },
    )
  }
  animate(text)
}

function renderText2(canvas: fabric.Canvas) {
  const text = new HighlightText('那些杀不死我的，终将使我更强大')
  text.selectable = false
  text.evented = false
  canvas.add(text)
  canvas.centerObject(text)
  text.top = 400
  text
    .setTexts([
      { text: '那些' },
      {
        text: '杀不死',
        highlight: {
          type: 'svg',
          url: 'https://cdn.dancf.com/fe-assets/20240816/2fd3d77e762a9209c2598cda99a34b93.svg?v=1',
          svgInfo: { colors: ['#afe7ffff'] },
        },
      },
      { text: '我的，终将使我' },
      {
        text: '更强大',
        highlight: {
          type: 'svg',
          url: 'https://cdn.dancf.com/fe-assets/20240813/c4db70c1b7a9c2fb1ded5039cbacbf2b.svg',
          svgInfo: { colors: ['#ffc300ff'] },
        },
      },
    ])
    .then((res) => {
      if (res) {
        canvas.requestRenderAll()
      }
    })
  const intervalId = setInterval(() => {
    if (text.texts) {
      const newTexts = [...text.texts]
      if (newTexts[1].highlight) {
        newTexts[1].highlight.svgInfo = {
          colors: [randomColor()],
        }
      }
      text.setTexts(newTexts).then((res) => {
        if (res) {
          canvas.requestRenderAll()
        }
      })
    }
  }, 500)

  return () => {
    clearInterval(intervalId)
  }
}

function renderText3(canvas: fabric.Canvas) {
  const text = new HighlightText('那些杀不死我的，终将使我更强大')
  text.selectable = false
  text.evented = false
  canvas.add(text)
  canvas.centerObject(text)
  text.top = 500
  let i = 0
  const rainbowColors = ['#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#00FFFF', '#0000FF', '#8B00FF']
  const intervalId = setInterval(() => {
    i++
    if (i > text.text.length - 1) {
      i = 0
    }
    text.setTexts([
      { text: text.text.slice(0, i) },
      {
        text: text.text.slice(i, i + 1),
        highlight: {
          type: 'svg',
          url: 'https://cdn.dancf.com/fe-assets/20240816/2fd3d77e762a9209c2598cda99a34b93.svg?v=1',
          svgInfo: { colors: [rainbowColors[i % rainbowColors.length]] },
        },
      },
      { text: text.text.slice(i + 1) },
    ])
  }, 200)

  return () => {
    clearInterval(intervalId)
  }
}

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fabricRef = useRef<fabric.Canvas | null>(null)

  useEffect(() => {
    const initFabric = () => {
      if (!canvasRef.current) return
      fabricRef.current = new fabric.Canvas(canvasRef.current)
    }
    initFabric()
    if (!fabricRef.current) return
    fabricRef.current.backgroundColor = 'white'

    renderText(fabricRef.current)
    const cb1 = renderText2(fabricRef.current)
    const cb2 = renderText3(fabricRef.current)

    const disposeFabric = () => {
      fabricRef.current?.dispose()
      fabricRef.current = null
    }
    ;(function render() {
      fabricRef.current?.requestRenderAll()
      fabric.util.requestAnimFrame(render)
    })()

    return () => {
      disposeFabric()
      cb1()
      cb2()
    }
  }, [])

  return (
    <>
      <div style={{ border: '1px solid #ccc' }}>
        <canvas ref={canvasRef} width={800} height={600} />
      </div>
    </>
  )
}

export default App
