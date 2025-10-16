// TESTING CODE

const url = "ws://192.168.1.114:8080"

const ws = new WebSocket(url)

let lcdUpdating = null
let msg = ""

let currentChannel = 0

let receivedMessages = 0
let sentMessages = 0

let shiftKey = false

const freqKnob = {
    active: false,
    mouseOrigin: null,
    origin: null,
    offsetAngle: 0
}
fetchText("./img/communicator.svg").then(data => {
    $("#svgContainer").html(data)
    $("#frequency_knob").on("mousedown", handleFreqKnob)
    $("body").on("mousemove", handleFreqKnob)
        .on("mouseup", handleFreqKnob)
    if (ws.readyState == ws.OPEN) wsReady()
    else ws.addEventListener("open", wsReady)

    window.addEventListener("keydown", e => write(e) && e.preventDefault())
    window.addEventListener("keyup", e => write(e) && e.preventDefault())

    $("#keyboard").children().children().each((index, child) => {
        child.classList.add("key")
        child.addEventListener("mousedown", e => {
            write(child.hasAttribute("inkscape:label") ? child.getAttribute("inkscape:label") : child.children.length ? child.children[0].innerHTML : child.innerHTML, true)
        })
        child.addEventListener("mouseup", e => {
            write(child.hasAttribute("inkscape:label") ? child.getAttribute("inkscape:label") : child.children.length ? child.children[0].innerHTML : child.innerHTML, false)
        })
    })
    write("", false, true)
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
}
function write(p1, p2, p3 = false) {

    let key = p2 == undefined ? p1.key.toLowerCase() : p1.toLowerCase()
    const pressed = p2 == undefined ? p1.type == "keydown" : p2
    const clear = p3
    const keyboard = !p2

    if (keyboard && key == "shift") {
        shiftKey = pressed
    } else if (key == "shift") {
        shiftKey = pressed
    }
    if (pressed) {
        if (key.length > 1) {
            switch (key) {
                case "backspace":
                    msg = msg.substring(0, msg.length - 1)
                    break
                default:
                    break
            }
        } else {
            msg += shiftKey ? upperCase(key) : key
        }

        $("#keyboard").children("#keys").children().each((index, child) => {
            if (child.getAttribute("inkscape:label").toLowerCase() == key) child.setAttribute("fill", "#b57b30")
        })

        const maxWidth = $("#lcdText").parent().get(0).getBBox().width * 0.85

        let page = 0

        const first = 6

        $("#lcdText").children().get(first).innerHTML = ""
        const last = msg.split("").reduce((prev, curr) => {
            const tspan = $("#lcdText").children().get(prev)
            tspan.innerHTML += curr
            if (tspan.getBBox().width > maxWidth) {
                const next = prev + 1 < $("#lcdText").children().length ? prev + 1 : first
                if (next == first) page++
                $("#lcdText").children().get(next).innerHTML = ""
                return next
            }
            return prev
        }, 6)

        if (page) updateLcd(["", "", "", "", "", `Message: ${page + 1}/${page + 1}`], false)

        for (let i = last; i < $("#lcdText").children().length; i++) {
            const el = $("#lcdText").children().get(i)
            if (i != last) {
                el.innerHTML = ""
                break
            }
            el.innerHTML += "<tspan class='blinky'>|</tspan>"
            const blinky = $(".blinky")
            const interval = setInterval(() => {
                const prev = blinky.html()
                if (!prev && prev != "") clearInterval(interval)
                else if (prev == "|") blinky.html("")
                else blinky.html("|")
            }, 500)
        }

    } else {
        $("#keyboard").children("#keys").children().each((index, child) => {
            if (child.getAttribute("inkscape:label").toLowerCase() == key || clear) child.setAttribute("fill", "#e2c196")
        })
    }
}
function upperCase(char) {
    switch (char) {
        case "1": return "!"
        case "2": return "@"
        case "3": return "#"
        case "4": return "$"
        case "5": return "%"
        case "6": return "'"
        case "7": return "&"
        case "8": return "?"
        case "9": return "("
        case "0": return ")"
        default: return char.toUpperCase()
    }
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
        "Message:"
    ])
    if (lcdUpdating) {
        lcdUpdating.then(() => {
            write("test", true)
            if (lcdUpdating) {
                lcdUpdating.then(() => {
                    write("test", true)
                })
            }
        })
    }
}

function updateLcd(rows = [" ", " ", " ", " ", " ", " "], animate = true) {
    if (lcdUpdating) {
        console.warn("LCD updater busy")
        lcdUpdating.then((val) => {
            lcdUpdating = val
            updateLcd(rows, animate)
        })
    } else {
        lcdUpdating = new Promise((resolve, reject) => {
            const lcdRows = $("#lcdText").children().toArray()
            let i = -1

            function updateLine() {
                const tspan = lcdRows[i]
                if (tspan && rows.length > i && rows[i]) {
                    tspan.innerHTML = rows[i]
                } else if (tspan && animate) {
                    tspan.innerHTML = tspan.getAttribute("data-prev")
                }
                const nextTspan = lcdRows[i + 1]

                if (nextTspan && animate) {
                    nextTspan.setAttribute("data-prev", nextTspan.innerHTML)
                    nextTspan.innerHTML = ""
                }
            }
            if (animate) {
                const interval = setInterval(() => {
                    if (i >= lcdRows.length) {
                        if (interval) clearInterval(interval)
                        resolve(null)
                    }
                    updateLine()
                    i++
                }, 100)
            } else {
                while (i < lcdRows.length) {
                    i++
                    a = !updateLine()
                }
                resolve(null)
            }
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
