import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    let frame = 0;

    const scroll = () => {
      if (frame < 2) {
        frame++;
        requestAnimationFrame(scroll);
      } else {
        window.scrollTo({ top: 0, behavior: 'instant' });
      }
    };

    requestAnimationFrame(scroll);

    return () => {
      frame = 2; // cancel future frames if unmounted
    };
  }, [pathname]);

  return null;
};

export default ScrollToTop;
