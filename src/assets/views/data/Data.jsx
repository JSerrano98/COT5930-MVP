import React, { useState, useEffect } from 'react';



const BACKEND = 'http://localhost:8000';

const renderdata = (filenames) =>{
   return(
    <div className='p-3  items-center divide-y divide-dashed md:divide-solid'>
    {filenames.map((file) => (
      <div className='flex items-center space-x-3'>
      <button className='btn'>download</button>
      <div> {file} </div>
      <hr />
      </div>
    ))}
    </div>
   )
};


  


const updateSelection = (filenames) => {
}

const Data = () => {
  const[filenames, setFilenames] = useState(null);
  const [loading, setLoading] = useState(true);
  const[headers ,setHeaders] = useState(null);
  const [select, setSelect] = useState('');
  const [select2, setSelect2] = useState('');

  
  const retrieveHeaders = async (file) => {
  //const params = new URLSearchParams();
  //filenames.forEach(item => params.append('file', item));
  //params.append(file)
  const encode = encodeURIComponent(file);
  try{
  const response =await fetch(BACKEND + `/ML?file=${encode}`);
  const result = await response.json();
  setHeaders(result);
  }
  catch(error){
    console.error('error acquiring file', error);
  }
  finally{
    return;
  };

  

}



  useEffect(() => { 
    const fetchData = async () => {
    try{
      const response = await fetch(BACKEND + '/CSV');
      const json = await response.json();
      console.log(json)
      setFilenames(json);

    }
    catch(error) {
      console.error("error fetching data:", error);

    }
    finally {
      setLoading(false);
    }
  };
  fetchData();
  }, []) ;
  if (loading) return <p>loading...</p>
  return (
    <>  
       
        <div className='btn'>{filenames ? renderdata(filenames) : 'No Excel files in Directory, please upload a file to continue'}</div>
        <div>
        {filenames && < select value={select} onChange={(e) => { setSelect(e.target.value)
           retrieveHeaders(e.target.value)}
        }>
          <option value="" disabled>Select a file</option>
          {filenames.map((file, index) => (
            <option key={index} value={file}>{file}</option>
          ))}
        </select>}
        </div>
        <div>
          {headers && <select value={select2} onChange={(e) => setSelect2(e.target.value)}>
            
            <option value='' disabled>select a feature</option>
            {headers.map((header, index) => (
              <option key={index} value={header}>{header}</option>   
            ))}
            </select>}
        </div>
    </>
  );
};

export default Data;