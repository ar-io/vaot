import AddVaotIdInput from '../inputs/AddVaotIdInput';
import Page from './Page';

function Home() {
  return (
    <Page className="px-[4rem] pt-4 h-full">
      <div className="flex w-full border-1 border-stone-500 rounded">
        <div className="flex flex-col gap-5 p-4 text-white">
          <h2 className="text-white text-6xl ">Welcome to VAOT</h2>
          <p>To start, add a VAOT ID using the input field in the navbar.</p>
        </div>
      </div>
    </Page>
  );
}

export default Home;
