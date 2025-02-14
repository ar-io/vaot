import { GithubIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { APP_VERSION } from '@src/constants';

function Footer() {
  return (
    <div className="flex px-[4rem] py-2 bg-stone-900 w-full justify-between border-t border-stone-700">
      <span className="text-md text-stone-500">{APP_VERSION}</span>
      <div className="flex gap-3 justify-center items-center">
        <Link
          to={'https://github.com/ar-io/vaot'}
          target="_blank"
          rel="noreferrer"
          className="text-md text-stone-400 hover:text-emerald-400 flex gap-2 justify-center items-center"
        >
          Github <GithubIcon width={'18px'} height={'18px'} />
        </Link>
      </div>
    </div>
  );
}

export default Footer;
