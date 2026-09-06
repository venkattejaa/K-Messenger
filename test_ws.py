import asyncio
import websockets
import json

async def test_ws():
    # Connect two clients
    uri1 = "ws://localhost:8000/ws/1?user_id=1"
    uri2 = "ws://localhost:8000/ws/2?user_id=2"
    
    ws1 = await websockets.connect(uri1)
    ws2 = await websockets.connect(uri2)
    
    print("Both connected")
    
    # Send chat message from user 1
    await ws1.send(json.dumps({
        "type": "chat",
        "text": "Hello from user 1",
        "media_url": None
    }))
    
    # Receive on user 2
    msg = await ws2.recv()
    print(f"User 2 received: {msg}")
    
    # Test signal
    await ws1.send(json.dumps({
        "type": "signal",
        "signal_type": "offer",
        "data": {"sdp": "test", "type": "offer"}
    }))
    
    msg = await ws2.recv()
    print(f"User 2 received signal: {msg}")
    
    await ws1.close()
    await ws2.close()
    print("Test passed!")

asyncio.run(test_ws())
