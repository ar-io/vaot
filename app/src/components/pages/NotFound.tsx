import { Link } from 'react-router-dom';
import Page from './Page';

function NotFound() {
  return (
    <Page className="flex flex-col justify-center items-center gap-5 p-5 h-full">
      <h1 className="text-5xl text-white">404 Not Found</h1>
      <img
        className="w-1/2 h-1/2"
        src={'https://arweave.net/JluJoV__SITJWXvtzkoKvsMoRqQOWnvVX7G6kAj2RdU'}
      />
      <Link to="/" className="text-blue-500">
        Go back to Home
      </Link>
    </Page>
  );
}
export default NotFound;
