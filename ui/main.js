// Auto detect dev and prod and use different endpoints
const url = window.location.href == "http://127.0.0.1:5500/" ? "ws://127.0.0.1:8080" : "wss://hekinav.hackclub.app/communicator-api/"

const ws = new WebSocket(url)

const converter = new showdown.Converter({
    tables: true,
    tasklists: true,
    strikethrough: true,
    emoji: true,
    simpleLineBreaks: true
})

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

let powerState = true


if ("ontouchstart" in document.documentElement) {
    popup([2], [true], ["Touchscreen input is not fully supported"])
}

ws.addEventListener("error", err => error(err, "ws_fail"))

// gets the svg and tutorial data
Promise.all([fetchText("./img/communicator.svg"), fetchJson("./data/tutorial.json")]).then(([svg, tutorialData]) => {

    // add the svg to the dom and inits all that depends on it
    $("#svgContainer").html(svg)
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
    $("#functions").children().on("mousedown", handleFunctionKeys).on("mouseup", handleFunctionKeys)
    $("#power_toggle").on("click", powerButton)

    $(".no-select").on("selectstart", false)
    $("#popups").each((index, element) => popup([index], [false]))

    window.addEventListener("resize", updatePrintLocation)

    // some just in case resetting
    updatePrintLocation()
    write("", false, true)
    popup()

    // start the tutorial view if the user hasnt completed ir
    if (localStorage.getItem("tutorial_complete") != "true") tutorial(tutorialData)

})




ws.addEventListener("message", (e) => {
    //messages from ws

    const data = JSON.parse(e.data)

    switch (data.type) {
        case "message":
            receivedMessages++
            reloadLcdStats()
            print(data.data.msg)
            break
        case "error":
            error(data.data.msg)
            break
        case "warning":
            warning(data.data.msg)
        default:
            break
    }
})

//updates the offsets on #print_paper in case the window is resized
function updatePrintLocation() {
    const printPaper = $("#print_paper")
    const location = document.querySelector("#printer_paper_location").getBoundingClientRect()

    printPaper.css({
        left: location.left,
        top: location.top,
        width: `calc(${location.width}px - 4em)`
    })
}

async function tutorial(data) {
    $("#focus_box").toggleClass("hidden")
    for (const view of data) {
        // waits until the user proceeds
        await tutorialView(view)
    }
    localStorage.setItem("tutorial_complete", "true")
    $("#focus_box").toggleClass("hidden")
}
function tutorialView(data) {

    return new Promise((resolve, reject) => {
        function e() {
            const target = $(data.selector).get(0)
            const targetBox = target ? target.getBoundingClientRect() : { x: 0, y: 0, width: 0, height: window.innerHeight }

            const box = document.getElementById("focus_box")

            const descText = document.querySelector("#focus_box .description")
            descText.innerHTML = data.text

            const textOnRight = targetBox.x + targetBox.width * 0.5 > window.innerWidth * 0.5
            descText.classList[textOnRight ? "add" : "remove"]("text-right")

            if (data.selector == "#popup-boundary") {
                popup([0, 1, 2], [true, true, true])
            } else {
                popup()
            }
            if (data.selector == "#printer") {
                print("Test Print")
            } else {
                printClear()
            }

            box.style.setProperty("--x", targetBox.x + "px")/*  */
            box.style.setProperty("--y", targetBox.y + "px")
            box.style.setProperty("--width", targetBox.width + "px")
            box.style.setProperty("--height", targetBox.height + "px")
            window.addEventListener("click", resolve, { once: true })
            window.addEventListener("resize", e, { once: true })

        }
        e()
    })
}
// prints a piece of markdown text as html from the printer
function print(text) {
    if (!text) {
        warning("Received empty message")
    }
    const convertedMD = "<div>"+converter.makeHtml(text)+"</div>"
    //ms per pixel
    const printSpeed = 100

    const printPaper = $("#print_paper")

    printPaper.css({ height: "auto" })

    const preHeight = printPaper.height()
    
    // goes to the top because flex-direction column-reverse
    printPaper.append($(convertedMD))
    const postHeight = printPaper.height()

    printPaper.css({ height: preHeight })

    printPaper.animate(
        { height: postHeight },
        (postHeight - preHeight) * printSpeed,
        "linear"
    )

}
function printClear() {
    const printPaper = $("#print_paper")
    printPaper.html("")
    printPaper.css({ height: 0 })
}
function broadcast(msg) {
    sentMessages++
    reloadLcdStats()
    print("you: " + msg)
    ws.send(JSON.stringify({ type: "broadcast", data: { msg: msg } }))
}
async function fetchText(url) {
    return await (await fetch(url)).text()
}
async function fetchJson(url) {
    return await (await fetch(url)).json()
}
function handleFreqKnob(e) {
    switch (e.type) {
        case "mousedown":
            // update offsets

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
            // actually switch the channel
            freqKnob.active = false

            const current = $("#frequency_knob").attr("transform") ? Number($("#frequency_knob").attr("transform").match(/rotate\((.*)\)/)[1]) : 0

            const channel = Math.round(range(35, 325, 20, 100, (current + 180) % 360)) * 10

            switchChannel(channel)

            break;
        case "mousemove":
            if (!freqKnob.active) return

            // big math to calculate the direction the knob should point at

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
    if (!powerState) return
    updateLcd([
        `CH ${channel}`, "", "CONNECTING"
    ])
    lcdUpdating.then(() => {
        reloadLcdStats()
    })
    printClear()
}
function handleFunctionKeys(ev) {
    if (!powerState) return
    if (ev.type == "mousedown") {
        const func = ev.currentTarget.id
        $("#functions").children(`#${func}`).children("rect").css("fill", "#b57b30")
        switch (func) {
            case "send":
                broadcast(msg)
                msg = ""
                write("test", false)
                break;
            case "enter":
                write("enter", true)
            default:
                break;
        }
    } else {
        $("#functions").find("rect").each((index, child) => {
            child.style.fill = "#e2c196"
        })
    }
}
function powerButton() {
    const pb = $("#power_toggle")
    powerState = !pb.children(".off.hidden").length
    pb.children(".on").toggleClass("hidden")
    pb.children(".off").toggleClass("hidden")
    if (powerState) {
        // the lcdUpdate function is badly made so this mess exists because of that
        updateLcd([" ", "DOOHICKEY", "SERIES 300", " ", " ", " ", "STARTING", "UP"])
        setTimeout(() => {
            updateLcd()
            updateLcd([
                `CH ${currentChannel}`, "", "CONNECTING"
            ])
            setTimeout(reloadLcdStats, 1000)
            $("#waveform").toggleClass("hidden")
        }, 1500)
    } else {
        msg = ""
        receivedMessages = 0
        sentMessages = 0
        popup()
        updateLcd([" ", "DOOHICKEY", "SERIES 300", " ", " ", " ", "SHUTTING", "DOWN", " ", " "])
        setTimeout(() => {
            updateLcd()
            $("#waveform").toggleClass("hidden")
        }, 1500)
    }
}
// keyboard main function
function write(p1, p2, p3 = false) {
    
    if (!powerState) return

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
                case "enter":
                    msg += "\n"
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
            tspan.innerHTML += curr == "\n" ? "↵" : curr
            if (tspan.getBBox().width > maxWidth || curr == "\n") {
                const next = prev + 1 < $("#lcdText").children().length ? prev + 1 : first
                if (next == first) page++
                $("#lcdText").children().get(next).innerHTML = ""
                return next
            }
            return prev
        }, 6)

        updateLcd(["", "", "", "", "", page ? `Message: ${page + 1}/${page + 1}` : "Message: "], false)

        for (let i = last; i < $("#lcdText").children().length; i++) {
            const el = $("#lcdText").children().get(i)
            if (i != last) {
                el.innerHTML = ""
                continue
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
function error(err, type) {
    let message = ""
    switch (type) {
        case "ws_fail":
            message = `Failed to initialize websocket on ${err.target.url}`
            break;
        default:
            break;
    }
    console.error(message)
    popup([0], [true], [message])
}
function warning(message) {
    console.warn(message)
    popup([1], [true], [message])
}
// error popups at the top, popup() clears them
function popup(indexes = [0, 1, 2], ups = [false, false, false], messages = ["", "", ""]) {
    const popups = $("#popups").children(".popup").toArray()
    indexes.forEach((i, index) => {
        const popupGroup = popups[i]

        const up = ups[index]
        const message = messages[index]
        popupGroup.classList[up ? "add" : "remove"]("up")

        popupGroup.querySelector("title").textContent = message
    })
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
function updateLcd(rows = [" ", " ", " ", " ", " ", " ", " ", " ", " ", " "], animate = true) {
    if (lcdUpdating) {
        // if lcd is animating, wait
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
                    // for the wave effect clear the next row
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
                //hopefully this doesnt get stuck and crash the browser
                while (i < lcdRows.length) {
                    i++
                    updateLine()
                }
                resolve(null)
            }
        })
    }
}
function roundStep(number, increment, offset = 0) {
    return Math.ceil((number - offset) / increment) * increment + offset;
}

// Math functions
function lerp(x, y, a) { return x * (1 - a) + y * a }
function clamp(a, min = 0, max = 1) { return Math.min(max, Math.max(min, a)) }
function invlerp(x, y, a) { return clamp((a - x) / (y - x)) }
function range(x1, y1, x2, y2, a) { return lerp(x2, y2, invlerp(x1, y1, a)) }
function angle(p1, p2) { return Math.atan2(p2.y - p1.y, p2.x - p1.x) }

