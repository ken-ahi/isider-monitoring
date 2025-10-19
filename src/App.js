
import { useState } from 'react';
import { ChildArea } from './ChileArea';

export default function App() {
  console.log('App');
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);

  const onChangeText = (e) => setText(e.target.value);

  const onClickOpen = () => setOpen(!open);

  return (
    <div>
      <input value={text} onChange={onChangeText}/>
      <br />
      <br />
      <button onClick={onClickOpen}>表示</button>
      <ChildArea open = {open} />
    </div>
  );
}