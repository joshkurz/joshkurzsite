import '../styles/globals.css'
import ReactGA from 'react-ga';
const TRACKING_ID = "UA-48759266-1"; // OUR_TRACKING_ID
ReactGA.initialize(TRACKING_ID);
ReactGA.pageview(window.location.pathname);

function MyApp({ Component, pageProps }) {
  return <Component {...pageProps} />
}

export default MyApp
