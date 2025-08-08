import '../styles/globals.css'
import { useEffect } from 'react';
import ReactGA from 'react-ga';

const TRACKING_ID = "UA-48759266-1"; // OUR_TRACKING_ID

function MyApp({ Component, pageProps }) {
  useEffect(() => {
    // ReactGA depends on the browser `window` object which does not exist on
    // the server. Wrapping the initialization in `useEffect` ensures it only
    // runs client-side after the component mounts and avoids "window is not
    // defined" errors during server-side rendering.
    if (typeof window !== 'undefined') {
      ReactGA.initialize(TRACKING_ID);
      ReactGA.pageview(window.location.pathname + window.location.search);
    }
  }, []);

  return <Component {...pageProps} />
}

export default MyApp
