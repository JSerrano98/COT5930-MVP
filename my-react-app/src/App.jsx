import { createPortal } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { Suspense, lazy } from 'react'
import { useState, useEffect, useTransition } from 'react';
import './App.css'
import { use } from 'react';





function App() {
const handleAddField = () =>{
  setPrompts([...prompts, {
    prompt: "",
  }])
}


const [prompts, setPrompts] = useState([{
  prompt: "",
}])

return(
  <>
     <div className='box'>
      {prompts.map(( prompt, i) => (
        <div>
    
          <select name="prompt" defaultValue="orange">
          <option value="orange">Orange</option>
          <option value="apple">apple</option>
          </select>
          <textarea></textarea>
         </div>
       ))}
      </div>
      <button onClick={handleAddField}>click me!</button>
    
    
       {console.log(prompts)}
  </>

  )
}



export default App;
  
