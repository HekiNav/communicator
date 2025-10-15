// TESTING CODE

const url = "ws://127.0.0.1:8080"

const ws = new WebSocket(url)

let lcdUpdating

let currentChannel = 0

let receivedMessages = 0
let sentMessages = 0

const freqKnob = {
    active: false,
    mouseOrigin: null,
    origin: null,
    offsetAngle: 0
}
fetchText("./img/communicator_plain.svg").then(data => {
    $("#svgContainer").html(data)
    $("#frequency_knob").on("mousedown", handleFreqKnob)
    $("body").on("mousemove", handleFreqKnob)
        .on("mouseup", handleFreqKnob)
    if (ws.readyState == ws.OPEN) wsReady()
    else ws.addEventListener("open", wsReady)
})




ws.addEventListener("message", (e) => {
    receivedMessages++
    reloadLcdStats()
    console.log("msg: ", JSON.parse(e.data))
})

function broadcast(msg) {
    sentMessages++
    reloadLcdStats()
    ws.send(JSON.stringify({ type: "broadcast", data: { msg: msg } }))
}

async function fetchText(url) {
    return await (await fetch(url)).text()
}

function handleFreqKnob(e) {
    switch (e.type) {
        case "mousedown":



            const { x, y, width, height } = document.getElementById("frequency_knob").getBoundingClientRect()

            const centerX = x + width / 2;
            const centerY = y + height / 2;

            const transform = $("#frequency_knob").attr("transform")

            freqKnob.active = true
            freqKnob.mouseOrigin = { x: e.clientX, y: e.clientY }
            freqKnob.origin = { x: centerX, y: centerY }
            freqKnob.offsetAngle = transform ? Number(transform.match(/rotate\((.*)\)/)[1]) : 0
            break;
        case "mouseup":
            freqKnob.active = false

            const current = $("#frequency_knob").attr("transform") ? Number($("#frequency_knob").attr("transform").match(/rotate\((.*)\)/)[1]) : 0

            const channel = Math.round(range(35, 325, 20, 100, (current + 180) % 360)) * 10

            switchChannel(channel)

            break;
        case "mousemove":
            if (!freqKnob.active) return

            const limits = [215, 145]

            const startAngle = angle(freqKnob.origin, freqKnob.mouseOrigin)

            const endAngle = angle(freqKnob.origin, { x: e.clientX, y: e.clientY })

            const calculatedAngle = ((endAngle - startAngle) * 180 / Math.PI + freqKnob.offsetAngle + 360) % 360

            const limitedAngle = calculatedAngle < 180 ? Math.min(calculatedAngle, limits[1]) : Math.max(calculatedAngle, limits[0])

            const currentAngle = $("#frequency_knob").attr("transform") ? Number($("#frequency_knob").attr("transform").match(/rotate\((.*)\)/)[1]) : 0

            const hopLimitedAngle = (currentAngle == limits[0] && limitedAngle <= limits[1]) || (currentAngle == limits[1] && limitedAngle >= limits[0]) ? currentAngle : limitedAngle


            const wavescale = range(35, 325, 10, 1, (hopLimitedAngle + 180) % 360)

            const snappedAngle = (range(20, 100, 35, 325, Math.floor(range(35, 325, 20, 100, (hopLimitedAngle + 180) % 360))) + 180) % 360

            $("#waveform").attr("transform", `scale(${wavescale},1)`)
            $("#frequency_knob").attr("transform-origin", "center")


            $("#frequency_knob").attr("transform", `rotate(${snappedAngle})`)
            $("#frequency_knob").attr("transform-origin", "center")

            break;
        default:
            break;
    }
}
function switchChannel(channel) {
    if (currentChannel == channel) return
    currentChannel = channel

    receivedMessages = 0
    sentMessages = 0

    ws.send(
        JSON.stringify(
            { type: "freq", data: { freq: channel } }
        )
    )

    updateLcd([
        `CH ${channel}`
    ])

    broadcast("hello fooba")
}

function wsReady() {
    switchChannel(600)
}
function reloadLcdStats() {
    updateLcd([
        "",
        "",
        `RECEIVED ${receivedMessages}`,
        `SENT ${sentMessages}`,
        "",
        "",
    ])
}

function updateLcd(rows = [" ", " ", " ", " ", " ", " "]) {
    if (lcdUpdating) {
        console.warn("LCD updater busy")
        lcdUpdating.then(() => {
            updateLcd(rows)
        })
    } else {

        lcdUpdating = new Promise((resolve, reject) => {
            const lcdRows = [1, 2, 3, 4, 5, 6].map(n => $(`#lcd_line_${n}`))
            let i = -1
            const interval = setInterval(() => {
                if (i >= lcdRows.length) {
                    clearInterval(interval)
                    lcdUpdating = null
                    resolve()
                    return
                }
                const tspan = lcdRows[i]
                if (tspan && rows.length > i && rows[i]) {
                    tspan.html(rows[i])
                } else if (tspan) {
                    tspan.html(tspan.attr("data-prev"))
                }
                const nextTspan = lcdRows[i + 1]

                if (nextTspan) {
                    nextTspan.attr("data-prev", nextTspan.html())
                    nextTspan.html("")
                }
                i++
            }, 100)
        })
    }
}
function roundStep(number, increment, offset = 0) {
    return Math.ceil((number - offset) / increment) * increment + offset;
}

function lerp(x, y, a) { return x * (1 - a) + y * a }
function clamp(a, min = 0, max = 1) { return Math.min(max, Math.max(min, a)) }
function invlerp(x, y, a) { return clamp((a - x) / (y - x)) }
function range(x1, y1, x2, y2, a) { return lerp(x2, y2, invlerp(x1, y1, a)) }

function angle(p1, p2) {
    return Math.atan2(p2.y - p1.y, p2.x - p1.x)
}
