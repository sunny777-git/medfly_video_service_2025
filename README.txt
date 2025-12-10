
# WebRTC Medical Streaming

## To run locally:
1. pip install -r requirements.txt
2. python app.py
3. Open http://localhost:5000 in 2 tabs or 2 devices

## To deploy on Render:
- Use `python app.py` as start command
- Deploy with web service through ngrok, port 5000

## Uses:
- Flask for server
- Socket.IO for signaling
- Xirsys TURN for NAT traversal

ngrok: 
it helps to deploy your localhost :5000 app to Server with HTTPS ( as it is not possible on loca)
AS WEB STREAMING REQUIRES - HTTPS
run on your command prompt: ngrok http 5000 ( make sure you do pip install ngrok)
then,
goto : https://dashboard.ngrok.com/get-started/setup/macos
hit    : https://madilynn-engaged-adaptively.ngrok-free.dev

this will open our application on server
then, 

turn on camera enable in browser
and then select device in list of devices
[ beside there is copy icon - where you can share the video sharable link to others. so that others ccan see]