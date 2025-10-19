# Communicator

A fun app where you can fiddle with a retro style radio transmitter/receiver.

## Features
- Retro ui with interactivity and :sparkles: animations:sparkles: (took way too long <img src="https://emoji.slack-edge.com/T0266FRGM/heavysob/55bf09f6c9d93d08.png" width="16">)
- Sending and receiving text at a certain "frequency" with websockets
- Built in frequencies that already have content

## Demo
[https://hekinav.github.io/communicator/](https://hekinav.github.io/communicator/)

Video
<video controls src="https://hc-cdn.hel1.your-objectstorage.com/s/v3/847aafd9b754d3c18d58caf63231d517589d5b9f_comm_demo.mp4" title="Title"></video>

## API

Available at [https://hekinav.hackclub.app/communicator-api/](https://hekinav.hackclub.app/communicator-api/) 

WebSocket only!

Messages in both directions are always stringified JSON objects as such: 

```json
{
    "type": "string",
    "data": {}
}
```

### Running locally

1. move to the api directory `cd api`

2. Install packages: `npm install`

3. Run the api `npm run dev` or run the prod version `npm run start`