
# WebRTC Medical Streaming

## To run locally:
1. pip install -r requirements.txt
2. python app.py
3. Open http://localhost:5000 in 2 tabs or 2 devices

## To deploy on Render:
- Use `python app.py` as start command
- Deploy with web service, port 5000

## Uses:
- Flask for server
- Socket.IO for signaling
- Xirsys TURN for NAT traversal
