import { useEffect, useState } from "react";

export function useWebsocket(url: string) {
  const [lastMessage, setLastMessage] = useState<any>(null);

  useEffect(() => {
    const ws = new WebSocket(url);
    
    ws.onmessage = (event) => {
      setLastMessage(JSON.parse(event.data));
    };
    
    return () => {
      ws.close();
    };
  }, [url]);

  return lastMessage;
}