import { useState, useEffect, useTransition } from 'react';

function dashboardAppend() {
    const [area, setarea] = useState()

    return(
        <div>
            <button onClick={handleClick}>+</button>
            {
                area.map((val,i) =>
                
                )
            }
        </div>
    )
}