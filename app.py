# app.py

import uuid,os
from flask import Flask, render_template, request, jsonify, send_from_directory
from flask_socketio import SocketIO, emit, join_room
from werkzeug.utils import secure_filename
import redis
from rq import Queue
from dotenv import load_dotenv
from sup_upload_tasks import upload_to_supabase

load_dotenv()

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")


BASE_DIR = os.path.abspath(os.path.dirname(__file__))
# Redis Queue
redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
redis_conn = redis.from_url(redis_url)
upload_queue = Queue(connection=redis_conn)

# Recording folder
TEMP_FOLDER = os.path.join(BASE_DIR, 'tmp', 'videos')
os.makedirs(TEMP_FOLDER, exist_ok=True)

# Room management
rooms = {}
viewers = {}
chat_logs = {}

@app.route('/')
def index():
    return render_template('video.html')

@app.route('/videos/temp/<filename>')
def serve_temp_video(filename):
    return send_from_directory(TEMP_FOLDER, filename)

@socketio.on('join')
def on_join(data):
    print("[JOIN EVENT]", data)  # 👈
    room = data.get('room', 'default')
    is_broadcaster = data.get('broadcaster', False)
    join_room(room)

    if is_broadcaster:
        if room in rooms:
            emit("broadcast-denied", {"reason": "Broadcaster already active"})
        else:
            rooms[room] = request.sid
            viewers[room] = set()
            chat_logs.setdefault(room, [])
            emit("chat-history", chat_logs[room], to=request.sid)
            print(f"[BROADCAST] {request.sid} started in '{room}'")
    else:
        if room in rooms:
            viewers.setdefault(room, set()).add(request.sid)
            emit("viewer-ready", {"viewer_id": request.sid}, to=rooms[room])
            emit("viewer-count", {"count": len(viewers[room])}, to=rooms[room])
            emit("chat-history", chat_logs.get(room, []), to=request.sid)
            print(f"[VIEWER] {request.sid} joined '{room}' (total: {len(viewers[room])})")
        else:
            emit("no-broadcaster", {"message": "No broadcaster found for this room."})

@socketio.on("viewer-ready")
def handle_viewer_ready(room):
    if room in rooms:
        emit("viewer-ready", {"viewer_id": request.sid}, to=rooms[room])

@socketio.on("offer")
def handle_offer(data):
    emit("offer", {"from": request.sid, "offer": data["offer"]}, to=data["to"])

@socketio.on("answer")
def handle_answer(data):
    emit("answer", {"from": request.sid, "answer": data["answer"]}, to=data["to"])

@socketio.on("candidate")
def handle_candidate(data):
    emit("candidate", {"from": request.sid, "candidate": data["candidate"]}, to=data["to"])

@socketio.on("disconnect")
def on_disconnect():
    sid = request.sid
    for room in list(rooms.keys()):
        if sid == rooms[room]:
            print(f"[DISCONNECT] Broadcaster {sid} left room '{room}'")
            del rooms[room]
            for v in viewers.get(room, []):
                emit("disconnect-viewer", {"reason": "Broadcaster disconnected"}, to=v)
            viewers.pop(room, None)
        elif sid in viewers.get(room, set()):
            viewers[room].remove(sid)
            emit("viewer-count", {"count": len(viewers[room])}, to=rooms.get(room))
            emit("disconnect-viewer", {"viewer_id": sid}, to=rooms.get(room))
            print(f"[DISCONNECT] Viewer {sid} left room '{room}'")

@app.route("/save-recording", methods=["POST"])
def save_recording():
    video = request.files["video"]
    filename = f"rec_{uuid.uuid4().hex}.webm"
    file_path = os.path.join(TEMP_FOLDER, filename)
    video.save(file_path)

    print(f"Saved locally: {file_path}")

    # Enqueue background job
    upload_queue.enqueue(upload_to_supabase, file_path, filename)

    return jsonify({"filename": filename})


@app.route("/uploaded/<filename>")
def uploaded(filename):
    public_url = (
        f"{os.getenv('SUPABASE_URL')}"
        f"/storage/v1/object/public/{os.getenv('SUPABASE_BUCKET')}/{filename}"
    )
    print("public url:", public_url)
    return jsonify({"url": public_url})

if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=5000, debug=True)
