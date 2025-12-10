console.log("✅ video.js loaded");

/* Socket and State */
const SIGNALING_SERVER = "https://madilynn-engaged-adaptively.ngrok-free.dev";

const socket = io(SIGNALING_SERVER, { transports: ["websocket"], secure: true });

const urlParams = new URLSearchParams(window.location.search);
let room = urlParams.get("room") || null;

const isViewer = !!room;

// ICE servers for NAT traversal and TURN support
const ICE_CONFIG = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    {
      urls: 'turn:115.98.148.169:3478',
      username: 'nani',
      credential: 'pass123'
    }
  ]
};

let mediaStream = null;
let peerConnections = {};
let isStreaming = false;
let mediaRecorder, recordedChunks = [], recInterval, recSeconds = 0;
let liveInterval, liveSeconds = 0;

document.addEventListener("DOMContentLoaded", () => {
  if (isViewer) {
    console.log("📺 Joining as viewer in room:", room);
    socket.emit("join", { room, broadcaster: false });
    document.body.classList.add("viewer-only");
  }
  console.log("✅ video.js fully executed");
});

/* Utility */
function formatTime(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = (sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

/* Camera List */
document.addEventListener("DOMContentLoaded", () => {
  if (!isViewer) {
    const select = document.getElementById("deviceSelect");
    if (select) {
      navigator.mediaDevices.enumerateDevices().then(devices => {
        select.innerHTML = '<option value="">Select Device</option>';
        devices.filter(d => d.kind === 'videoinput').forEach(device => {
          const opt = document.createElement('option');
          opt.value = device.deviceId;
          opt.text = device.label || `Camera ${device.deviceId}`;
          select.appendChild(opt);
        });
      });
    }
  }
});


/* Toggle Stream */
function toggleStream() {
  const video = document.getElementById("localVideo");
  const img = document.getElementById("defaultImage");
  const btn = document.getElementById("startBtn");
  const icon = btn.querySelector("i");
  const deviceId = document.getElementById("deviceSelect")?.value;

  if (!isStreaming) {
    if (!deviceId) {
      alert("Please select a device first.");
      return;
    }

    navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: deviceId } }, audio: true })
      .then(stream => {
        mediaStream = stream;
        video.srcObject = stream;
        video.controls = false;
        document.getElementById("generateLinkBtn").disabled = false;
        document.getElementById("snapshotBtn").disabled = false;
        document.querySelector('.video-controls').style.display = 'flex';
        document.getElementById("recordBtn").disabled = false;
        document.getElementById("liveBadge").style.display = 'flex';
        img.style.display = "none";
        document.querySelector('.overlay').style.display = 'flex';
        icon.className = "fas fa-pause";
        isStreaming = true;

        // ✅ Generate room only if not set already
        if (!room) {
          room = deviceId + '-' + Math.random().toString(36).substr(2, 5);
        }

        socket.emit("join", { room, broadcaster: true });
        console.log("📢 Sent join with room:", room);

        liveSeconds = 0;
        clearInterval(liveInterval);
        liveInterval = setInterval(() => {
          liveSeconds++;
          document.getElementById("liveLabel").textContent = `LIVE • ${formatTime(liveSeconds)}`;
          document.getElementById("customProgress").style.width = `${(liveSeconds % 60) * (100 / 60)}%`;
        }, 1000);
      })
      .catch(error => {
        console.error("❌ Error accessing media devices:", error);
        alert("Could not start stream. Check permissions or device access.");
      });

  } else {
    mediaStream.getTracks().forEach(track => track.stop());
    video.srcObject = null;
    document.getElementById("generateLinkBtn").disabled = true;
    document.getElementById("snapshotBtn").disabled = true;
    document.getElementById("recordBtn").disabled = true;
    document.getElementById("liveBadge").style.display = 'none';
    document.querySelector('.overlay').style.display = 'none';
    img.style.display = "block";
    icon.className = "fas fa-play";
    isStreaming = false;
    clearInterval(liveInterval);
    document.getElementById("customProgress").style.width = '0%';
  }
}

/* Toggle Recording */
function toggleRecording() {
  const recordBtn = document.getElementById("recordBtn");

  if (!mediaRecorder || mediaRecorder.state === "inactive") {
    recordedChunks = [];
    mediaRecorder = new MediaRecorder(mediaStream, { mimeType: "video/webm; codecs=vp9" });

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunks.push(e.data);
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(recordedChunks, { type: "video/webm" });
      const url = URL.createObjectURL(blob);

      const video = document.createElement("video");
      video.src = url;
      video.controls = true;
      video.style.width = "100%";
      video.style.borderRadius = "12px";

      const wrapper = document.createElement("div");
      Object.assign(wrapper.style, { background: "#111", borderRadius: "12px", marginBottom: "12px" });
      wrapper.appendChild(video);

      const recContainer = document.getElementById("recordings");
      recContainer.prepend(wrapper);
      if (recContainer.style.display === "none") showTab("recordings");

      // Optional: auto-upload later if desired
    };

    recSeconds = 0;
    mediaRecorder.start();
    recordBtn.innerHTML = `<i class="fas fa-stop"></i> Recording • 00:00`;

    recInterval = setInterval(() => {
      recSeconds++;
      const formatted = formatTime(recSeconds);
      recordBtn.innerHTML = `<i class="fas fa-stop"></i> Recording • ${formatted}`;
    }, 1000);

    console.log("⏺️ Recording started");
  } else {
    mediaRecorder.stop();
    clearInterval(recInterval);
    recordBtn.innerHTML = `<i class="fas fa-circle"></i> Record`;
    console.log("⏹️ Recording stopped");
  }
}


/* Handle incoming offer (Viewer) */
socket.on("offer", async ({ from, offer }) => {
  console.log("📡 Received offer from", from);
  const pc = new RTCPeerConnection(ICE_CONFIG);
  peerConnections[from] = pc;

  pc.ontrack = (event) => {
    const remoteStream = event.streams[0];
    const videoEl = document.getElementById("localVideo");

    if (videoEl && (!videoEl.srcObject || videoEl.srcObject.id !== remoteStream.id)) {
      videoEl.srcObject = remoteStream;
      console.log("🔁 Remote stream attached to video element.");
      console.log("🎥 Stream tracks:", remoteStream.getTracks().length);
    }
  };

  pc.onconnectionstatechange = () => {
    console.log("🔄 PeerConnection state:", pc.connectionState);
  };

  await pc.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  socket.emit("answer", { to: from, answer });

  // ✅ ADD THIS LINE:
  socket.emit("viewer-ready", { viewer_id: socket.id });

  console.log("✅ Answer sent to broadcaster.");
});


/* Handle incoming answer (Broadcaster) */
socket.on("answer", async ({ from, answer }) => {
  const pc = peerConnections[from];
  if (pc) {
    await pc.setRemoteDescription(new RTCSessionDescription(answer));
    console.log("📥 Received answer from viewer:", from);
  }
});

/* Viewer Ready */
socket.on("viewer-ready", ({ viewer_id }) => {
  console.log("🎯 Viewer ready:", viewer_id);
  if (!isViewer && mediaStream) {
    const pc = new RTCPeerConnection(ICE_CONFIG);
    peerConnections[viewer_id] = pc;

    mediaStream.getTracks().forEach(track => {
      pc.addTrack(track, mediaStream);
      console.log("🎬 Added track:", track.kind);
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("candidate", { to: viewer_id, candidate: event.candidate });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log("🔄 PeerConnection state:", pc.connectionState);
    };

    pc.createOffer().then(offer => {
      pc.setLocalDescription(offer);
      socket.emit("offer", { to: viewer_id, offer });
    });
  }
});

/* ICE Candidates */
socket.on("candidate", ({ from, candidate }) => {
  console.log("📥 Received ICE candidate from", from);
  const pc = peerConnections[from];
  if (pc && candidate) {
    pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.error);
  }
});

/* Generate Link */
if (!isViewer) {
  const linkBtn = document.getElementById("generateLinkBtn");

  if (linkBtn) {
    linkBtn.addEventListener("click", () => {
      if (!isStreaming) {
        alert("Please click the Play button to start the stream before generating a link.");
        return;
      }

      // ✅ If room already set (during toggleStream), reuse it
      if (!room) {
        const deviceId = document.getElementById("deviceSelect").value;
        if (!deviceId) {
          alert("Please select a device first.");
          return;
        }

        room = deviceId + '-' + Math.random().toString(36).substr(2, 5);
      }

      const link = `${window.location.origin}?room=${room}`;

      navigator.clipboard.writeText(link)
        .then(() => alert("Shared link copied to clipboard!"))
        .catch(err => {
          console.error("Failed to copy link: ", err);
          alert("Failed to copy link. Try manually.");
        });
    });
  }
}


/* Snapshot */
function captureSnapshot() {
  const video = document.getElementById("localVideo");
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext("2d").drawImage(video, 0, 0);
  const imageUrl = canvas.toDataURL("image/png");

  const img = document.createElement("img");
  img.src = imageUrl;
  img.style.width = "100%";
  img.style.borderRadius = "12px";
  img.style.cursor = "pointer";
  img.onclick = () => img.requestFullscreen?.();

  const wrapper = document.createElement("div");
  Object.assign(wrapper.style, { background: "#222", borderRadius: "12px", marginBottom: "12px" });
  wrapper.appendChild(img);

  const snapContainer = document.getElementById("snapshots");
  snapContainer.prepend(wrapper);
  if (snapContainer.style.display === "none") showTab("snapshots");
}

function toggleRecording() {
  const recBadge = document.getElementById("recBadge");
  const recordBtn = document.getElementById("recordBtn");
  const stream = document.getElementById("localVideo").srcObject;

  if (!mediaRecorder || mediaRecorder.state === 'inactive') {
    recSeconds = 0;
    document.getElementById("recLabel").textContent = `REC • 00:00`; // ✅ Reset label
    document.getElementById("recProgress").style.width = '0%';       // ✅ Reset progress

    recordedChunks = [];
    mediaRecorder = new MediaRecorder(stream);

    mediaRecorder.ondataavailable = e => recordedChunks.push(e.data);

    mediaRecorder.onstop = () => {
      const blob = new Blob(recordedChunks, { type: 'video/webm' });
      const fileName = `rec_${Date.now()}.webm`;
      const localUrl = URL.createObjectURL(blob);

      const formData = new FormData();
      formData.append("video", blob, fileName);

      fetch("/save-recording", { method: "POST", body: formData })
        .then(res => res.json())
        .then(data => {
          const card = document.createElement('div');
          card.className = 'recording-card';
          card.textContent = 'Uploading...';
          document.getElementById('recordings').prepend(card);

          const interval = setInterval(() => {
            fetch(`/uploaded/${data.filename}`)
              .then(res => res.json())
              .then(resp => {
                if (resp.url.includes('.webm')) {
                  clearInterval(interval);
                  const videoEl = document.createElement('video');
                  videoEl.src = resp.url;
                  videoEl.controls = true;
                  card.innerHTML = '';
                  card.appendChild(videoEl);
                }
              });
          }, 3000);
        });

      const card = document.createElement('div');
      card.className = 'recording-card';
      const videoEl = document.createElement('video');
      videoEl.src = localUrl;
      videoEl.controls = true;
      card.appendChild(videoEl);
      document.getElementById('recordings').prepend(card);
    };

    mediaRecorder.start();
    recBadge.style.display = 'flex';
    recInterval = setInterval(() => {
      recSeconds++;
      document.getElementById("recLabel").textContent = `REC • ${formatTime(recSeconds)}`;
      document.getElementById("recProgress").style.width = `${(recSeconds % 60) * (100 / 60)}%`;
    }, 1000);

    recordBtn.classList.add("recording-active");
    recordBtn.innerHTML = '<i class="fas fa-stop"></i>';
  } else {
    mediaRecorder.stop();
    clearInterval(recInterval);
    recBadge.style.display = 'none';
    document.getElementById("recProgress").style.width = '0%';
    recordBtn.classList.remove("recording-active");
    recordBtn.innerHTML = '<i class="fas fa-circle"></i>';
  }
}


/* Fullscreen */
function toggleFullscreen() {
  const vc = document.querySelector(".video-grid");
  if (!document.fullscreenElement) vc.requestFullscreen().catch(console.error);
  else document.exitFullscreen();
}

/* Tab Switching */
function showTab(tabId) {
  document.querySelectorAll('.tab-pane').forEach(p => p.style.display = 'none');
  document.getElementById(tabId).style.display = 'flex';
  document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
  const idx = { snapshots: 0, recordings: 1 }[tabId];
  if (idx !== undefined) document.querySelectorAll('.tab-button')[idx].classList.add('active');
}
