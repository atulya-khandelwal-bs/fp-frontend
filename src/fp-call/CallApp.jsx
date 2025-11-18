import { VideoCalling } from "./components/VideoCalling.jsx";
import "./CallApp.css";

function CallApp({
  userId,
  peerId,
  channel,
  isInitiator,
  onEndCall,
  isAudioCall = false,
}) {
  return (
    <div>
      <VideoCalling
        userId={userId}
        peerId={peerId}
        channel={channel}
        isInitiator={isInitiator}
        onEndCall={onEndCall}
        isAudioCall={isAudioCall}
      />
    </div>
  );
}

export default CallApp;
