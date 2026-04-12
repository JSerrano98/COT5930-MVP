import asyncio
import websockets
import numpy as np
import json
import random
import time
from websockets.asyncio.server import serve
##CONNECTIONS = set()
##message = 'hello world'

##async def echo(websocket):
  ##if websocket not in CONNECTIONS:
    ##CONNECTIONS.add(websocket)
  ##async for message in websocket:
    ##websockets.broadcast(CONNECTIONS,message)


async def send_dat(websocket):
    x = 0 
    while(x < 100):
      rand_int = random.randint(1, 20)
      data = {"Stream": "stream1", "random": rand_int}
      json_data = json.dumps(data)
      await websocket.send(json_data)
      x += 1

async def main():
    async with websockets.serve(send_dat, "localhost", 8765) as server:
      await server.serve_forever()  # run forever


if __name__ == "__main__":
    asyncio.run(main())