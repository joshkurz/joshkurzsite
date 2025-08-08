import '../styles/globals.css'
import { useEffect } from 'react';
import Head from 'next/head';
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

  return (
    <>
      <Head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </Head>
      <Component {...pageProps} />
    </>
  )
}

export default MyApp
