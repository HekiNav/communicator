import { WebSocketServer } from "ws"

const wss = new WebSocketServer({ port: process.env.PORT })

wss.on("listening", () => {
    console.log(`Listening on port ${process.env.PORT}`)
})

const frequencies = new Map()

wss.on("connection", (socket) => {
    let currentFreq = null

    socket.on("message", (msg) => {
        const { data, type } = JSON.parse(msg)

        console.log(data)

        if (!data) return error(socket, "invalid message.data object")
        if (!type) return error(socket, "invalid message.type object")

        switch (type) {
            case "freq":
                if (!checkParams(socket, data, "freq")) return

                if (!(Number(data.freq) && Number(data.freq) >= 200 && Number(data.freq) <= 1000 && Number(data.freq))) {
                    return error(socket, "Invalid frequency ID. Valid: int between 200 and 999")
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
                if (!checkParams(socket, data, "msg")) return error(socket, "aa")
                if (!currentFreq) return error("You are not currently on any frequency")
                for (const client of frequencies.get(currentFreq)) {
                    if (client.readyState == 1) {
                        client.send(JSON.stringify({ type: "message", data: { freq: currentFreq, msg: data.msg } }))
                    }
                }
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

function checkParams(socket, object, ...keys) {
    const missing = keys.reduce((prev, curr) => object[curr] ? prev : [...prev, curr], [])
    if (missing.length) error(socket, `Following keys from the message.data object are missing: ${missing}`)
    return !missing.length
}



function error(socket, msg) {
    socket.send(JSON.stringify({ type: "error", data: { msg: msg } }))
}
