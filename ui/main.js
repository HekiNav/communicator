// TESTING CODE

const url = "ws://127.0.0.1:8080"

const ws = new WebSocket(url)

const freqKnob = {
    active: false,
    mouseOrigin: null,
    origin: null
}
fetchText("./img/communicator_plain.svg").then(data => {
    $("#svgContainer").html(data)
    $("#frequency_knob").on("mousedown", handleFreqKnob)
    $("body").on("mousemove", handleFreqKnob)
        .on("mouseup", handleFreqKnob)
})


ws.addEventListener("open", (e) => {
    ws.send(
        JSON.stringify(
            { type: "freq", data: { freq: 200 } }
        )
    )

    broadcast("hello fooba")
})

ws.addEventListener("message", (e) => {
    console.log("msg: ", JSON.parse(e.data))
})

function broadcast(msg) {
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

            freqKnob.active = true
            freqKnob.mouseOrigin = { x: e.clientX, y: e.clientY }
            freqKnob.origin = { x: centerX, y: centerY }

            break;
        case "mouseup":
            freqKnob.active = false
            break;
        case "mousemove":
            if (!freqKnob.active) return

            const startAngle = angle(freqKnob.origin, freqKnob.mouseOrigin)

            const endAngle = angle(freqKnob.origin, { x: e.clientX, y: e.clientY })

            console.log((endAngle - startAngle) * 180 / Math.PI)

            $("#frequency_knob").attr("transform", `rotate(${(endAngle - startAngle) * 180 / Math.PI})`)
            $("#frequency_knob").attr("transform-origin", "center")

            break;
        default:
            break;
    }
}
function angle(p1, p2) {
    return Math.atan2(p2.y - p1.y, p2.x - p1.x)
}
