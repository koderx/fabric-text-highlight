import * as fabric from 'fabric'

interface Highlight {
  type: 'svg'
  url: string
  svgInfo: SvgInfo
}

export interface SvgInfo {
  colors: string[]
}

const svgCache = new Map<string, string>()
export async function downloadSvg(item: HighlightText) {
  const highlights = item.texts?.map((t, index) => ({ index, highlight: t.highlight })).filter((h) => !!h.highlight)

  if (!highlights || highlights.length === 0) return false

  for (const { index: i, highlight } of highlights) {
    if (!highlight) continue
    if (highlight.type === 'svg') {
      if (!highlight.url) continue

      try {
        if (!svgCache.has(highlight.url)) {
          const svg = await fetch(highlight.url).then((res) => res.text())
          svgCache.set(highlight.url, svg)
        }

        const realSvg = (svgCache.get(highlight.url) as string)
          .replace(/{{\s*color\s*}}/g, () => {
            return highlight.svgInfo.colors[0] || ''
          })
          .replace(/{{\s*colors\[(\d+)\]\s*}}/g, (_, args) => {
            return highlight.svgInfo.colors[Number.parseInt(args[0])] || ''
          })
        const svgData = await fabric.loadSVGFromString(realSvg)
        item._svgData?.set(i, svgData)
      } catch (error) {
        console.warn('download svg failed, ', error)
      }
    }
  }
  return true
}

type TextsType = Pick<fabric.FabricText, 'text'> & {
  highlight?: Highlight
}

interface UniqueProps {
  texts?: TextsType[]
}

export interface SerializedHighlightTextProps extends fabric.SerializedTextProps, UniqueProps {}

export interface HighlightTextProps extends fabric.TextProps, UniqueProps {}

export class HighlightText<
  Props extends fabric.TOptions<HighlightTextProps> = Partial<HighlightTextProps>,
  SProps extends SerializedHighlightTextProps = SerializedHighlightTextProps,
  EventSpec extends fabric.ObjectEvents = fabric.ObjectEvents,
> extends fabric.FabricText<Props, SProps, EventSpec> {
  static type = 'Text'
  texts?: TextsType[]
  _svgData?: Map<number, Awaited<ReturnType<typeof fabric.loadSVGFromString>>> = new Map()

  toObject<T extends Omit<Props & fabric.TClassProperties<this>, keyof SProps>, K extends keyof T = never>(
    propertiesToInclude: K[] = [],
  ): Pick<T, K> & SProps {
    return super.toObject([...propertiesToInclude, 'texts'] as K[])
  }

  setTexts(texts: TextsType[]) {
    this.texts = texts
    this._svgData = new Map()
    return downloadSvg(this).then((res) => {
      this.dirty = true
      return res
    })
  }
  _renderHighlight(ctx: CanvasRenderingContext2D) {
    try {
      if (!this.texts) {
        return
      }
      const textsLen = this.texts.reduce((pv, t) => pv + t.text.length, 0)
      if (textsLen !== this.text.length) {
        throw 'texts length not match'
      }
      const indexLineMap: number[] = []
      const index2IndexOfLine: number[] = []
      const lineTop: number[] = []
      let curLineTop = 0
      for (let line = 0; line < this._textLines.length; line++) {
        lineTop.push(curLineTop)
        curLineTop += this.getHeightOfLine(line)
        const c = this._textLines[line]
        if (c) {
          for (let i = 0; i < c.length; i++) {
            index2IndexOfLine.push(i)
          }
          indexLineMap.push(...Array(c.length).fill(line))
        }
      }

      const textsSplit: {
        textsIndex: number
        lineIndex: number
        // 该行位置[start, end)
        start: number
        end: number
        textObj: TextsType
      }[] = []
      let idx = 0
      for (let tIdx = 0; tIdx < this.texts.length; tIdx++) {
        const tObj = this.texts[tIdx]
        if (tObj.text.length === 0) {
          continue
        }
        // 这里content是前面download下载的
        if (!tObj.highlight || tObj.highlight.type !== 'svg' || !tObj.highlight.url) {
          idx += tObj.text.length
          continue
        }
        let startLineIndex = indexLineMap[idx] as number
        let startIdx = 0
        for (let i = 0; i < tObj.text.length; i++) {
          const curLineIndex = indexLineMap[idx + i] as number
          if (curLineIndex !== startLineIndex) {
            textsSplit.push({
              textsIndex: tIdx,
              start: index2IndexOfLine[idx + startIdx] as number,
              end: (index2IndexOfLine[idx + i - 1] as number) + 1,
              lineIndex: startLineIndex,
              textObj: {
                ...tObj,
                text: tObj.text.substring(startIdx, i),
              } as TextsType,
            })
            startIdx = i
            startLineIndex = curLineIndex
          }
        }
        textsSplit.push({
          textsIndex: tIdx,
          start: index2IndexOfLine[idx + startIdx] as number,
          end: (index2IndexOfLine[idx + tObj.text.length - 1] as number) + 1,
          lineIndex: startLineIndex,
          textObj: {
            ...tObj,
            text: tObj.text.substring(startIdx),
          } as TextsType,
        })
        idx += tObj.text.length
      }
      // console.log('_renderText', textsSplit, this.__charBounds)
      for (const t of textsSplit) {
        const svg = this._svgData?.get(t.textsIndex)
        if (t.lineIndex >= this.__charBounds.length) {
          continue
        }
        const curCharBoxs = this.__charBounds[t.lineIndex] as Required<fabric.GraphemeBBox>[]
        const charBox = curCharBoxs[t.start] as Required<fabric.GraphemeBBox>
        const lastCharBox = curCharBoxs[t.end] as Required<fabric.GraphemeBBox>
        const left = this._getLeftOffset() + this._getLineLeftOffset(t.lineIndex) + charBox.left
        const top = this._getTopOffset() + (lineTop[t.lineIndex] as number)
        const width = lastCharBox.left - charBox.left
        const height = charBox.height
        // console.log(t.textObj.text, left, top, lastCharBox.left - charBox.left, charBox.height)
        if (svg) {
          // stackoverflow.com/questions/79148818/typeerror-is-not-iterable-when-adding-svg-to-fabricjs-canvas
          const highlightMark = fabric.util.groupSVGElements(svg.objects as fabric.Object[], {
            ...svg.options,
            selectable: false,
            evented: false,
          })
          highlightMark.set({
            left,
            top,
            scaleX: width / highlightMark.width,
            scaleY: height / highlightMark.height,
          })
          highlightMark.render(ctx)
        } else {
          // 手动画框
          // ctx.save()
          // ctx.fillStyle = t.textObj.highlight?.svgInfo.colors[0] || '#9FFFFC'
          // ctx.fillRect(left, top, width, height)
          // ctx.restore()
        }
      }
    } catch (e) {
      console.log('_renderText error', e)
    }
  }
  _renderText(ctx: CanvasRenderingContext2D) {
    this._renderHighlight(ctx)
    super._renderText(ctx)
  }
}
fabric.classRegistry.setClass(HighlightText, 'Text')
