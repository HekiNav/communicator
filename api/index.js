import { WebSocketServer } from "ws"
import { generateUsername } from "unique-username-generator";

const wss = new WebSocketServer({ port: process.env.PORT })



wss.on("listening", () => {
    console.log(`Listening on port ${process.env.PORT}`)
    issTracker()
})

const frequencies = new Map()

wss.on("connection", (socket, request) => {
    let currentFreq = null
    //random name e.g. unanticipated-mold48 
    const userName = generateUsername("-",2)

    socket.on("message", (msg) => {
        const { data, type } = JSON.parse(msg)

        // lots of error handling
        if (!data) return error(socket, "invalid message.data object")
        if (!type) return error(socket, "invalid message.type object")

        switch (type) {
            case "freq":
                if (!checkParams(socket, data, "freq")) return

                if (!(Number(data.freq) && Number(data.freq) >= 200 && Number(data.freq) <= 1000 && Number(data.freq))) {
                    return error(socket, "Invalid frequency ID. Valid: int between (including) 200 and 1000")
                }

                // if already connected remove from previous connection
                if (currentFreq && frequencies.has(currentFreq)) {
                    frequencies.get(currentFreq).delete(socket)
                }
                currentFreq = data.freq
                if (!frequencies.has(currentFreq)) frequencies.set(currentFreq, new Set())
                frequencies.get(currentFreq).add(socket)
                break;
            case "broadcast":
                if (!checkParams(socket, data, "msg")) return
                if (!currentFreq) return error(socket, "You are not currently on any frequency")
                if (data.msg == "") return warning(socket, "The message you sent was empty and thus not broadcasted")
                frequencyCheck(currentFreq, data.msg)
                broadcast(data.msg, socket, currentFreq, userName)
                break
            default:
                return error(socket, `Unknown message type: ${type}`)
        }
    })

    socket.on("close", () => {
        if (currentFreq && frequencies.has(currentFreq)) {
            frequencies.get(currentFreq).delete(socket)
        }
    })
})

function broadcast(msg, sentSocket, freq, id) {
    for (const client of frequencies.get(freq)) {
        if (client.readyState == 1 && client != sentSocket) {
            client.send(JSON.stringify({ type: "message", data: { freq: freq, msg: id + ": " + msg } }))
        }
    }
}

function frequencyCheck(freq, msg) {
    switch (freq) {
        case 300:
            broadcast(msg, null, 300, "echo")
            break;
        default:
            break;
    }
}

function checkParams(socket, object, ...keys) {
    const missing = keys.reduce((prev, curr) => object[curr] || object[curr] == "" ? prev : [...prev, curr], [])
    if (missing.length) error(socket, `Following keys from the message.data object are missing: ${missing}`)
    return !missing.length
}



function error(socket, msg) {
    socket.send(JSON.stringify({ type: "error", data: { msg: msg } }))
}
function warning(socket, msg) {
    socket.send(JSON.stringify({ type: "warning", data: { msg: msg } }))
}

// fun addon that send the place the ISS is currently over to channel 610
function issTracker() {
    console.log("ISS TRACKING")
    setInterval(() => {
        const freq = frequencies.get(610)
        // only run if someone is listening
        if (freq && freq.size) {
            getIssData()
        }
    }, 10_000)
}
async function getIssData() {
    const pos = await fetchJson("https://api.wheretheiss.at/v1/satellites/25544")
    const addr = await fetchJson(`https://api.geoapify.com/v1/geocode/reverse?lat=${pos.latitude}&lon=${pos.longitude}&apiKey=0430c8455a4541c2b89bbe08910b7e20`)
    if (addr.features[0]) {
        broadcast(`The ISS is currently over ${addr.features[0].properties.formatted}`, null, 610, "iss tracker")
    } else {
        broadcast("The ISS is currently over the middle of nowhere", null, 610, "iss tracker")
    }
}

async function fetchText(url) {
    return await (await fetch(url)).text()
}
async function fetchJson(url) {
    return await (await fetch(url)).json()
}