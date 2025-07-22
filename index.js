const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 3000 });
const rooms = new Map();
const clients = new Map(); // 플레이어 ID별 소켓 저장

wss.on('connection', function connection(ws) {
  console.log('클라이언트 접속');

  ws.on('message', function incoming(message) {
    let data;
    try {
        data = JSON.parse(message);
    } catch (e) {
        console.error('Invalid JSON:', message);
        return;
    }

    const { type, roomId, playerId, ...rest } = data;
    console.log("파싱된 메시지 전체:", data);


    switch (type) {
    

      case "ready": {
        const { userId, vehicle } = rest;
        console.log("[READY] roomId:", roomId, "userId:", userId, "vehicle:", vehicle);

        if (!rooms.has(roomId)) {
            // 방이 없으면 새로 만든다 (자동 생성)
            rooms.set(roomId, { student: null, police: null });
        }

        const room = rooms.get(roomId);
        let role, playerId;

        if (!room.student) {
            role = "student";
            playerId = 1;
            room.student = { ws, playerId,vehicle, userId };
        } else if (!room.police) {
            role = "police";
            playerId = 2;
            room.police = { ws, playerId, vehicle, userId };
        } else {
            // 이미 꽉 찬 경우
            ws.send(JSON.stringify({ type: "error", message: "역할이 이미 찼습니다." }));
            return;
        }

        clients.set(playerId, ws);

        // 클라이언트에 역할 통보
        ws.send(JSON.stringify({
            type: "player_joined",
            playerId,
            role
        }));

        // 게임 시작 조건 체크
        if (room.student && room.police) {
            broadcast(roomId, {
                type: "game_started",
                roomId,
                players: [
                    {
                        playerId: room.student.playerId,
                        vehicle: room.student.vehicle,
                        role: "student"
                    },
                    {
                        playerId: room.police.playerId,
                        vehicle: room.police.vehicle,
                        role: "police"
                    }
                ]
            });
        }

        break;
        }




      case 'start': {
        const { time, track } = rest;
        broadcast(roomId, {
            type: 'start',
            time,
            track
        });
        break;
        }


      case 'player_state': { 
        const { x, y, z, velocity, turn } = rest;
        broadcastExceptSender(ws, {
            type: 'player_state',
            playerId,
            x, y, z, velocity, turn
        });
        break;
        }


      case 'police_state': {
        const { x, y, z, velocity, turn } = rest;
        broadcastExceptSender(ws, {
            type: 'police_state',
            x, y, z, velocity, turn
        });
        break;
        }


      case 'chat': {
        const { chat } = rest;
        broadcast(roomId, {
            type: 'chat',
            playerId,
            chat
        });
        break;
        }


      case 'game_over': {
        const { winnerId, time } = rest;
        broadcast(roomId, {
            type: 'game_over',
            winnerId,
            time
        });
        break;
        }


      case 'exit':
        clients.delete(playerId);
        broadcast(roomId,{ 
            type: 'exit',
            playerId
        });
        break;

      default:
        console.log('알 수 없는 타입:', type);
    }
  });

  ws.on('close', () => {
    console.log('클라이언트 연결 종료');
    for (const [id, client] of clients.entries()) {
      if (client === ws) {
        clients.delete(id);
        broadcast({ type: 'exit', playerId: id });
        break;
      }
    }
  });
});

function broadcast(roomId, data) {
  const room = rooms.get(roomId);
  if (!room) return;

  const recipients = [room.student?.ws, room.police?.ws];
  recipients.forEach((client) => {
    if (client && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}


function broadcastExceptSender(sender, data) {
  const json = JSON.stringify(data);
  for (const client of clients.values()) {
    if (client !== sender) {
      client.send(json);
    }
  }
}

function canStartGame(roomId) {
  const room = rooms.get(roomId);
  return room && room.student && room.police;
}






console.log('WebSocket 서버 실행 중: ws://localhost:3000');
