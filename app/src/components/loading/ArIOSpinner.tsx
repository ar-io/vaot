import Lottie, { LottieComponentProps } from 'lottie-react';
import arioLoading from '../animations/ario-spinner.json';

function ArIOSpinner(props: Omit<LottieComponentProps, 'animationData'>) {
  return <Lottie {...props} animationData={arioLoading} />;
}

export default ArIOSpinner;
