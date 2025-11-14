import { VideoCalling } from "./components/VideoCalling.jsx";
import "./CallApp.css";

function CallApp({ userId, peerId, channel, isInitiator, onEndCall }) {
  return (
    <div>
      <VideoCalling
        userId={userId}
        peerId={peerId}
        channel={channel}
        isInitiator={isInitiator}
        onEndCall={onEndCall}
      />
    </div>
  );
}

export default CallApp;
