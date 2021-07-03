import React, { useRef, useEffect } from 'react'

export default (props) => {

    const canvasRef = useRef(null)
    const cutPaths = props.cutPaths;

    const drawPreview = (ctx, frameCount) => {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        const margin = ctx.canvas.width / 20; //in px
        const scale = (ctx.canvas.width - margin * 2) / props.sheetWidth;

        ctx.beginPath();
        ctx.fillStyle = '#316063'
        ctx.rect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.fill();

        ctx.beginPath()
        ctx.strokeStyle = '#426F72'
        for (let x = 0; x <= props.sheetWidth; x++) {
            ctx.moveTo(x * scale + margin, margin);
            ctx.lineTo(x * scale + margin, ctx.canvas.height - margin);
        }
        for (let y = 0; y <= props.sheetWidth; y++) {
            ctx.moveTo(margin, y * scale + margin);
            ctx.lineTo(ctx.canvas.width - margin, y * scale + margin);
        }
        ctx.stroke()

        if (cutPaths && cutPaths.length) {
            var lastPoint = {x: 0, y: 0, type: 0}
            for (const seg of cutPaths) {
                for (const point of seg) {
                    ctx.beginPath()
                    ctx.moveTo(lastPoint.x * scale + margin, lastPoint.y * scale + margin);
                    if (point.type == 2) { //moveTo
                        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
                    } else if (point.type == 1) {
                        ctx.strokeStyle = 'rgba(186, 220, 241, 0.85)';
                    } else if (point.type == 0) {
                        ctx.strokeStyle = 'rgba(241, 186, 241, 0.85)';
                    } else {
                        ctx.strokeStyle = '#FF0000';
                    }
                    ctx.lineTo(point.x * scale + margin, point.y * scale + margin);
                    lastPoint = point;
                    ctx.stroke()
                }
            }
        }

    }

    useEffect(() => {

        const canvas = canvasRef.current
        const context = canvas.getContext('2d')
        let frameCount = 0
        let animationFrameId

        const render = () => {
            canvas.width = Math.min(canvas.parentElement.clientWidth, canvas.parentElement.clientHeight - 50) * 0.9; //scale up to fit either width or height
            canvas.height = canvas.width / props.sheetWidth * props.sheetHeight;
            frameCount++
            drawPreview(context, frameCount)
            animationFrameId = window.requestAnimationFrame(render)
        }
        render()

        return () => {
            window.cancelAnimationFrame(animationFrameId)
        }
    }, [drawPreview])

    return <canvas ref={canvasRef} />
}

