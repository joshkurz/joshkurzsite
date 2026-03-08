import '../styles/globals.css'
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { pageview } from '../lib/analytics';

function MyApp({ Component, pageProps }) {
  const router = useRouter();

  useEffect(() => {
    // Track the initial page load
    pageview(window.location.pathname + window.location.search);

    // Track subsequent client-side navigations
    const handleRouteChange = (url) => pageview(url);
    router.events.on('routeChangeComplete', handleRouteChange);
    return () => router.events.off('routeChangeComplete', handleRouteChange);
  }, [router.events]);

  return <Component {...pageProps} />;
}

export default MyApp;
