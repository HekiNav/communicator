// TESTING CODE

const ws = new WebSocket("ws://127.0.0.1:8080")


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
