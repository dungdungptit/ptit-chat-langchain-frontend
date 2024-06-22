import { useState, useEffect } from 'react';

interface IProps {
  text: string,
  delay: number,
  infinite?: boolean,
  after?: any
}
const Typewriter = (props: IProps) => {
  const [currentText, setCurrentText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [rendered, setRendered] = useState(false);
  useEffect(() => {
    let timeout;
    if (currentIndex <= props.text.length-1) {
      timeout = setTimeout(() => {
        setCurrentText(prevText => prevText + props.text[currentIndex]);
        setCurrentIndex(prevIndex => prevIndex + 1);
      }, props.delay);

    } else if (props.infinite) { // ADD THIS CHECK
      setCurrentIndex(0);
      setCurrentText('');
    } else {
      setRendered(true);
    }

    return () => clearTimeout(timeout);
  }, [currentIndex, props.delay, props.infinite, props.text]);

  return <span>
    {currentText}
    <div style={{marginTop: '20px'}}>{rendered && props.after}</div>
  </span>;
};

export default Typewriter;