import React, {useState, useEffect} from 'react';
 const handlePrompt = (e, i) => {
  const {name, value = e.target};
  let newPrompts = [...prompts]
  newPrompts[i][name] = value;
  setPrompts(newPrompts);
 }

const Stream = () => {

    const [messages, setMessages] = useState([]);
    const [ws, setWs] = useState(null);

  useEffect(() => {
    const websocket = new Websocket('ws://localhost:8765');

    websocket.onopen = () => {
        console.log('Websocket is connected');
    }

    websocket.onmessage = (evt) => {
        const messages = (evt.data);
    
    }
    websocket.onclose = () => {
        console.log('Websocket is closed')

    }

    setWs(websocket);
    return () => {
        websocket.close();
    };
  }, []);


return (
     <div>
            <h1>
                Real-time Updates with WebSockets
                and React Hooks - Client
            </h1>
            {messages.map((message, index) =>
                <p key={index}>{message}</p>)}
    </div>
)
};

export default Stream;